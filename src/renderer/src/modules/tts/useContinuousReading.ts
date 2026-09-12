// tts · 连续朗读编排 hook（Phase 2）。
// 职责：句子队列推进 + 预取无缝衔接 + 自动翻章 + 跳转 + 驱动高亮/滚屏/同步。
// 连读单位 = 句；同一段仅第一句触发高亮、滚屏、剪贴板和 AI 暂存。
//
// 关键设计（会话 17 续2 修 bug）：
// - 世代令牌 epoch：start/jumpTo/翻章续读都 bump epoch，每条 runFromIdx 抓 myEpoch，每个 await
//   后校验失配即作废。根治「并发陈旧循环」（旧循环+新循环并发打架 → 跳读/重读）。
// - 当前句先合成再预取：runFromIdx 先 await 当前句，播放启动后才发后面 N 句预取。根治「预取阻塞
//   当前句」（SoVITS 串行，预取排前面 → 当前句干等十几秒、cmd 跑到很后面还没出声）。
// - 在途可中断：合成带 AbortController，jump/stop 中断在途请求，尽快腾空 SoVITS 串行队列。
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import type { VirtuosoHandle } from 'react-virtuoso'
import type { Segment, ChapterMeta } from '../../../../shared/contracts'
import type { VoiceProfile } from '../../../../shared/contracts'
import { splitTtsSentences } from './tts-text'
import {
  synthesizeToUrl, playUrl, stop,
  setReading, setCurrentSeq, stopReading, endReading, setReadingStopper, getPlayback
} from './playback-store'

// 预取窗口：播当前段时提前合成后面 N 段。短句（分段细的书）播放时间 < 合成时间，
// 只预取 1 段会跟不上；预取多段让 SoVITS 按到达顺序串行排队，播到时已就绪。
const PREFETCH_AHEAD = 3

// 在 segments 里找第一个非 image 的可朗读段（跳过纯图片段）。
export function firstReadableIdx(segs: Segment[]): number {
  return segs.findIndex((s) => s.type !== 'image' && s.jp_text)
}

// 从 curIdx 起找下一个可朗读段；返 -1 = 章尾（需翻章）。
export function nextReadableIdx(segs: Segment[], curIdx: number): number {
  for (let i = curIdx + 1; i < segs.length; i++) {
    if (segs[i].type !== 'image' && segs[i].jp_text) return i
  }
  return -1
}

export type ContinuousUtterance = {
  key: string
  segmentIndex: number
  segmentSeq: number
  sentenceIndex: number
  text: string
}

export function buildContinuousUtterances(segs: Segment[]): ContinuousUtterance[] {
  const utterances: ContinuousUtterance[] = []
  segs.forEach((seg, segmentIndex) => {
    if (seg.type === 'image' || !seg.jp_text) return
    splitTtsSentences(seg.jp_text).forEach((text, sentenceIndex) => {
      utterances.push({
        key: `${seg.seq}:${sentenceIndex}`,
        segmentIndex,
        segmentSeq: seg.seq,
        sentenceIndex,
        text
      })
    })
  })
  return utterances
}

export function voiceProfileCacheKey(profile: Partial<VoiceProfile> | null): string {
  if (!profile) return ''
  return JSON.stringify([
    profile.id,
    profile.engine,
    profile.baseURL,
    profile.refAudioPath,
    profile.promptText,
    profile.promptLang,
    profile.textLang,
    profile.speedFactor,
    profile.apiKey,
    profile.model,
    profile.voice
  ])
}

export type ContinuousReadingHook = {
  start: (fromSeq?: number) => void   // fromSeq 缺省 = 屏顶段
  jumpTo: (seq: number) => void        // 连读中点击跳转
  stop: () => void
}

export function useContinuousReading({
  segments,
  chapters,
  chapterIndex,
  goToChapter,
  virtuosoRef,
  activeProfile,
  onSegStart,        // 段开始时回调：同步剪贴板 + AI 暂存框（滚屏由 Reader 的 currentSeq effect 处理）
  focusedIdxRef,     // Reader 的屏顶章内下标 ref
}: {
  segments: Segment[]
  chapters: ChapterMeta[]
  chapterIndex: number
  goToChapter: (idx: number) => void
  virtuosoRef: RefObject<VirtuosoHandle | null>
  activeProfile: VoiceProfile | null
  onSegStart: (seg: Segment) => void
  focusedIdxRef: RefObject<number>
}): ContinuousReadingHook {
  // 用 ref 持最新值，避免连读闭包陈旧。
  const segmentsRef = useRef(segments)
  segmentsRef.current = segments
  // 每次章节数据变化只构建一次句子队列；递归播放、跳转和预取共用同一快照。
  const utterances = useMemo(() => buildContinuousUtterances(segments), [segments])
  const utterancesRef = useRef(utterances)
  utterancesRef.current = utterances
  const profileRef = useRef(activeProfile)
  profileRef.current = activeProfile
  const profileCacheKey = voiceProfileCacheKey(activeProfile)
  const profileCacheKeyRef = useRef(profileCacheKey)
  const chapterIndexRef = useRef(chapterIndex)
  chapterIndexRef.current = chapterIndex
  const chaptersRef = useRef(chapters)
  chaptersRef.current = chapters

  // goToChapter 身份不稳（依赖 chapterIndex）→ 用 ref 稳住，避免 runFromIdx 反复重建。
  const goToChapterRef = useRef(goToChapter)
  goToChapterRef.current = goToChapter
  const onSegStartRef = useRef(onSegStart)
  onSegStartRef.current = onSegStart

  // 预取缓存：段序号:句序号 → blob URL（已合成待播）。
  const prefetchCache = useRef(new Map<string, string>())
  // 预取在途：朗读单元 key → 中断器 + Promise。播到仍在合成的句子时复用 Promise，
  // 避免句子变短后现场合成与预取重复进入 SoVITS 串行队列。
  // 每轮预取窗口重叠（播 N 时取 N+1..N+3，播 N+1 时取 N+2..N+4）会把同一段重复合成 3~4 次，
  // SoVITS 串行队列被自己的重复请求塞满，当前段反而排在后面干等。
  const prefetchInFlight = useRef(
    new Map<string, { controller: AbortController; promise: Promise<string> }>()
  )
  // 是否有待翻章的连读挂起（翻章后 segments 到达时继续）。
  const pendingChapterRef = useRef(false)
  // 连读是否运行中（ref 版，避免闭包陈旧；state 版用 getPlayback().reading）。
  const activeRef = useRef(false)
  // 世代令牌：每次 start/jumpTo/翻章续读 bump，旧异步循环靠比对失配自我作废。
  const epochRef = useRef(0)
  // 连读合成的在途中断器（jump/stop 时 abort 腾空 SoVITS 队列）。
  const abortRef = useRef<AbortController | null>(null)

  const clearPrefetch = useCallback(() => {
    for (const pending of prefetchInFlight.current.values()) pending.controller.abort()
    prefetchInFlight.current.clear()
    for (const url of prefetchCache.current.values()) URL.revokeObjectURL(url)
    prefetchCache.current.clear()
  }, [])

  // 声音档案修改后，正在播放的当前句不受影响；旧配置的预取请求/缓存立即作废。
  useEffect(() => {
    if (profileCacheKeyRef.current === profileCacheKey) return
    profileCacheKeyRef.current = profileCacheKey
    clearPrefetch()
  }, [profileCacheKey, clearPrefetch])

  // 后台预取一句（结果存缓存，失败静默——播到时再合成兜底）。
  // 带 epoch 快照校验：jump/stop 后旧循环的预取结果不许再入缓存
  // （否则新循环/停播后缓存里可能残留旧章节的 URL，revoke 时序也乱）。
  const prefetch = useCallback((utterance: ContinuousUtterance | undefined) => {
    const p = profileRef.current
    if (!utterance || !p) return
    if (
      prefetchCache.current.has(utterance.key) ||
      prefetchInFlight.current.has(utterance.key)
    ) return
    const epochAtSend = epochRef.current
    const profileKeyAtSend = profileCacheKeyRef.current
    const ac = new AbortController()
    const promise = synthesizeToUrl(p, utterance.text, ac.signal)
    prefetchInFlight.current.set(utterance.key, { controller: ac, promise })
    void promise
      .then((url) => {
        const stale =
          !activeRef.current ||
          epochAtSend !== epochRef.current ||
          profileKeyAtSend !== profileCacheKeyRef.current
        // 期间可能已被 runFromIdx 现场合成填了缓存；直接 set 会顶掉那条且不吊销。
        if (stale || prefetchCache.current.has(utterance.key)) URL.revokeObjectURL(url)
        else prefetchCache.current.set(utterance.key, url)
      })
      .catch(() => {})
      .finally(() => {
        if (prefetchInFlight.current.get(utterance.key)?.controller === ac) {
          prefetchInFlight.current.delete(utterance.key)
        }
      })
  }, [])

  // 从章内朗读单元 idx 起连读一句：段首同步一次 → 播 → 预取后面 N 句 → 播完推进。
  const runFromIdx = useCallback(
    async (idx: number, myEpoch: number): Promise<void> => {
      const segs = segmentsRef.current
      const queue = utterancesRef.current
      const utterance = queue[idx]
      const seg = utterance ? segs[utterance.segmentIndex] : undefined
      const profile = profileRef.current
      if (!seg || !utterance || !profile) { stopReading(); activeRef.current = false; return }
      if (myEpoch !== epochRef.current) return // 已被更新的循环取代

      // 同一段内多句只在第一句更新高亮、滚屏、剪贴板和 AI 暂存。
      if (utterance.sentenceIndex === 0) {
        setCurrentSeq(seg.seq)
        onSegStartRef.current(seg)
      }

      // 当前句先取已完成缓存；仍在预取则直接等待同一 Promise，不重复合成。
      let url = prefetchCache.current.get(utterance.key)
      if (url !== undefined) prefetchCache.current.delete(utterance.key)
      if (url === undefined) {
        const pending = prefetchInFlight.current.get(utterance.key)
        if (pending) {
          try {
            url = await pending.promise
            prefetchCache.current.delete(utterance.key)
          } catch {
            if (myEpoch === epochRef.current) { stopReading(); activeRef.current = false }
            return
          }
        } else {
          const ac = new AbortController()
          abortRef.current = ac
          try {
            url = await synthesizeToUrl(profile, utterance.text, ac.signal)
          } catch {
            if (myEpoch === epochRef.current) { stopReading(); activeRef.current = false }
            return
          }
        }
      }
      if (myEpoch !== epochRef.current) {
        // 合成期间被跳转/停：吊销本段 URL（已从缓存取走，无残留死 URL）。
        URL.revokeObjectURL(url)
        return
      }

      // 播放启动后才预取后面 N 句（不阻塞当前句；SoVITS 串行按序排队）。
      // 章内下一句的下标要在播完后按「当时」的 segments 重算：播放期间用户可能手动翻章，
      // 此处快照算出的 nextIdx 是旧章数组的下标，拿去读新章会跳到毫不相干的位置。
      for (let k = 1; k <= PREFETCH_AHEAD; k++) {
        prefetch(queue[idx + k])
      }

      const result = await playUrl(url)
      URL.revokeObjectURL(url)
      if (result === 'stopped' || myEpoch !== epochRef.current) return // 被打断/跳转
      if (result === 'error') {
        // 单段解码失败：整场连读就此打住，但保留 status='error' 让用户看见原因
        // （stopReading 会把 status 抹回 idle，用户只见朗读无声停下）。
        activeRef.current = false
        endReading()
        return
      }

      // 播完 → 推进。章内有下一段则续；章尾则翻章（挂起等新 segments）。
      // 用最新 segments 重算，且确认仍是同一章（手动翻章会换掉整个数组）。
      const curSegs = segmentsRef.current
      const nextIdx = curSegs === segs && idx + 1 < queue.length ? idx + 1 : -1
      if (curSegs !== segs) {
        // 播放期间章已换（用户手动翻章）：本轮循环就此结束，由 Reader 侧决定是否续读，
        // 绝不按旧下标闯进新章。
        activeRef.current = false
        stopReading()
        return
      }
      if (nextIdx >= 0) {
        void runFromIdx(nextIdx, myEpoch)
      } else if (chapterIndexRef.current < chaptersRef.current.length - 1) {
        pendingChapterRef.current = true
        goToChapterRef.current(chapterIndexRef.current + 1)
      } else {
        stopReading(); activeRef.current = false // 全书完
      }
    },
    [prefetch]
  )

  // 翻章后新 segments 到达 → 从首个可朗读段续读（新 epoch）。
  useEffect(() => {
    if (!pendingChapterRef.current || segments.length === 0) return
    pendingChapterRef.current = false
    const idx = utterances.length > 0 ? 0 : -1
    if (idx >= 0 && activeRef.current) {
      const myEpoch = ++epochRef.current
      void runFromIdx(idx, myEpoch)
    } else if (idx < 0) { stopReading(); activeRef.current = false }
  }, [segments, utterances, runFromIdx])

  const start = useCallback(
    (fromSeq?: number) => {
      const segs = segmentsRef.current
      let idx = fromSeq != null ? segs.findIndex((s) => s.seq === fromSeq) : focusedIdxRef.current
      if (idx < 0) idx = focusedIdxRef.current
      // 从该处起找可朗读段（屏顶可能是 image）。
      if (segs[idx]?.type === 'image' || !segs[idx]?.jp_text) idx = nextReadableIdx(segs, idx - 1)
      if (idx < 0) return
      const utteranceIdx = utterancesRef.current.findIndex(
        (utterance) => utterance.segmentIndex === idx
      )
      if (utteranceIdx < 0) return
      abortRef.current?.abort()
      clearPrefetch()
      activeRef.current = true
      setReading(true)
      const myEpoch = ++epochRef.current
      void runFromIdx(utteranceIdx, myEpoch)
    },
    [clearPrefetch, runFromIdx, focusedIdxRef]
  )

  const jumpTo = useCallback(
    (seq: number) => {
      if (!getPlayback().reading) return
      const idx = utterancesRef.current.findIndex(
        (utterance) => utterance.segmentSeq === seq
      )
      if (idx < 0) return
      abortRef.current?.abort() // 中断在途合成，腾空 SoVITS 队列
      stop() // 停当前播放（resolve stopped）
      clearPrefetch()
      activeRef.current = true
      const myEpoch = ++epochRef.current // 作废旧循环
      void runFromIdx(idx, myEpoch)
    },
    [clearPrefetch, runFromIdx]
  )

  const stopFn = useCallback(() => {
    activeRef.current = false
    pendingChapterRef.current = false
    epochRef.current++ // 作废所有在跑的循环
    abortRef.current?.abort()
    clearPrefetch()
    stopReading()
  }, [clearPrefetch])

  // 关朗读开关 = 彻底停连读。store 够不到 epoch/activeRef/在途合成，
  // 必须由编排器把停止入口交给它，否则等合成的循环会在开关关掉后继续读下去。
  useEffect(() => {
    setReadingStopper(stopFn)
    return () => setReadingStopper(null)
  }, [stopFn])

  // 卸载清理（换书/离开阅读器）。store 是模块级、活得比组件久：
  // 只 stop() 会留下 reading=true/currentSeq，回到书架再开书时
  // 停止按钮凭空存在、点词被当作连读跳转、还会按残留 seq 乱滚屏。
  useEffect(
    () => () => {
      activeRef.current = false
      pendingChapterRef.current = false
      epochRef.current++
      abortRef.current?.abort()
      clearPrefetch()
      stopReading()
    },
    [clearPrefetch]
  )

  return { start, jumpTo, stop: stopFn }
}
