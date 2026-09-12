import { useCallback, useEffect, useRef, useState } from 'react'
import type { Segment, ChapterMeta } from '../../../../shared/contracts'
import type { Token, TokenizeReq } from '../../../../worker/contract'
import { TokenizerClient } from './tokenizer-client'
import { findChapterIndex } from './chapter-nav'
import { SegmentTokenStore } from './segment-token-store'
import { tokenizeWindow } from './tokenize-window'

const PREFETCH = 12 // 视口外少量预取，避免快速滚动时一次排队过多分词请求

type Mode = TokenizeReq['mode']

export type UseReader = {
  chapters: ChapterMeta[]
  chapterIndex: number // 当前章在 chapters 里的位次
  segments: Segment[] // 仅当前章的段（按章加载，根治白屏 + 守性能红线）
  tokens: SegmentTokenStore
  loading: boolean // 当前章段加载中
  dictError: string | null // 分词词典加载失败根因（null=正常）；顶部横幅显示
  goToChapter: (idx: number) => void
  tokenizeRange: (startIdx: number, endIdx: number) => void
}

// reader-view 数据核心：**按章加载**（只载当前章的段，用 listChapters 的 startSeq/endSeq + getSegments）。
// 根治白屏：不再从全书空数组起、章首不再是全书图片堆；用数据就绪后 scrollToIndex 定位（Reader 侧）。
// 视口内段落即时分词（Worker，契约 2），预取下一屏。DOM 由 Virtuoso 只挂视口内（总纲第 5、7 节）。
// initialSeq（进度恢复，默认 0）：定位到它所属的章 + 章内偏移（Reader 侧 scrollToIndex）。
export function useReader(bookId: number, mode: Mode, initialSeq = 0): UseReader {
  const [chapters, setChapters] = useState<ChapterMeta[]>([])
  const [chapterIndex, setChapterIndex] = useState(0)
  const [segments, setSegments] = useState<Segment[]>([])
  const [tokens] = useState(() => new SegmentTokenStore())
  const [loading, setLoading] = useState(true)
  const [dictError, setDictError] = useState<string | null>(null)

  const clientRef = useRef<TokenizerClient | null>(null)
  const tokenBatchRef = useRef<Map<number, Token[]>>(new Map())
  const tokenFlushRef = useRef<number | null>(null)
  const tokenGenerationRef = useRef(0)
  const requestedTokensRef = useRef(new Set<number>())

  const flushTokenUpdates = useCallback(() => {
    tokenFlushRef.current = null
    const batch = tokenBatchRef.current
    tokenBatchRef.current = new Map()
    for (const [seq, result] of batch) tokens.set(seq, result)
  }, [tokens])

  const resetTokens = useCallback(() => {
    tokenGenerationRef.current++
    requestedTokensRef.current.clear()
    tokenBatchRef.current.clear()
    if (tokenFlushRef.current !== null) window.cancelAnimationFrame(tokenFlushRef.current)
    tokenFlushRef.current = null
    tokens.clear()
  }, [tokens])

  const scheduleTokenFlush = useCallback(() => {
    if (tokenFlushRef.current !== null) return
    tokenFlushRef.current = window.requestAnimationFrame(flushTokenUpdates)
  }, [flushTokenUpdates])

  const queueTokenUpdate = useCallback((seq: number, tokensForSegment: Token[]) => {
    tokenBatchRef.current.set(seq, tokensForSegment)
    scheduleTokenFlush()
  }, [scheduleTokenFlush])

  useEffect(() => () => {
    tokenGenerationRef.current++
    if (tokenFlushRef.current !== null) window.cancelAnimationFrame(tokenFlushRef.current)
    tokenFlushRef.current = null
    tokenBatchRef.current.clear()
  }, [])

  // 起 worker。**必须在 effect 里建 + 清 ref**（不在 render 建）：React StrictMode(dev) 双挂载会
  // mount→unmount→remount，unmount 的 cleanup 会 terminate worker；若在 render 用 ref 建、cleanup 只
  // dispose 不清 ref，则 remount 时 ref 仍指向已终止的 worker，分词请求全被丢进死 worker（无响应无报错）。
  // 在 effect 里建、cleanup 里 dispose+清 ref，remount 就会重建一个活 worker。
  // 生产词典路径债：dev 用默认 /sudachi/system.dic，打包后 file:// 失效需 configure(dictUrl)。
  // 词典加载失败 → 顶部横幅显示根因（供无法开 F12 的场景）。
  useEffect(() => {
    const c = new TokenizerClient((reason) => setDictError(reason))
    clientRef.current = c
    return () => {
      c.dispose()
      clientRef.current = null
    }
  }, [bookId])

  // 换书：拉章节表，定位 initialSeq 所属章为起始章。
  useEffect(() => {
    let alive = true
    setChapters([])
    setChapterIndex(0)
    setSegments([])
    resetTokens()
    setLoading(true)
    void window.chion.listChapters(bookId).then((chs) => {
      if (!alive) return
      setChapters(chs)
      setChapterIndex(chs.length ? findChapterIndex(chs, initialSeq) : 0)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, resetTokens])

  // 换章：只取当前章的段（闭区间 [startSeq, endSeq]），清 tokens 视图重算。
  useEffect(() => {
    const ch = chapters[chapterIndex]
    if (!ch) return
    let alive = true
    setLoading(true)
    resetTokens()
    void window.chion.getSegments(bookId, ch.startSeq, ch.endSeq).then((batch) => {
      if (!alive) return
      setSegments(batch)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [bookId, chapters, chapterIndex, resetTokens])

  const goToChapter = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= chapters.length || idx === chapterIndex) return
      setChapterIndex(idx)
    },
    [chapters.length, chapterIndex]
  )

  // 最近一次分词请求的章内区间（换 mode 时按它重分视口 + 预取，避免切 A/B/C 后词框全丢）。
  const lastRangeRef = useRef<[number, number]>([0, 20])

  // 对给定索引区间（含预取余量）内的 pair/heading 段请求分词。索引是**章内**下标。
  const tokenizeRange = useCallback(
    (startIdx: number, endIdx: number) => {
      const c = clientRef.current
      if (!c) return // effect 未跑完（worker 未就绪）时跳过；rangeChanged/冷启动会再触发
      lastRangeRef.current = [startIdx, endIdx]
      const generation = tokenGenerationRef.current
      const visibleKeys = new Set<string>()
      for (let index = Math.max(0, startIdx); index <= Math.min(segments.length - 1, endIdx); index++) {
        const segment = segments[index]
        if (segment?.type !== 'image' && segment?.jp_text) visibleKeys.add(c.key(segment.seq, mode))
      }
      c.reprioritize(visibleKeys)
      const cachedHits: Array<[number, Token[]]> = []
      for (const index of tokenizeWindow(startIdx, endIdx, segments.length, PREFETCH)) {
        const seg = segments[index]
        if (!seg || seg.type === 'image' || !seg.jp_text) continue
        if (tokens.get(seg.seq) || tokenBatchRef.current.has(seg.seq) || requestedTokensRef.current.has(seg.seq)) continue
        const cached = c.peek(seg.seq, mode)
        if (cached) {
          // 已缓存但换章时 tokens 视图被清空 → 必须回填，否则重访已读章降级纯文本（词框消失）。
          cachedHits.push([seg.seq, cached])
          continue
        }
        requestedTokensRef.current.add(seg.seq)
        const priority = index >= startIdx && index <= endIdx ? 0 : 1
        void c.tokenize(seg.seq, seg.jp_text, mode, priority).then((result) => {
          if (generation !== tokenGenerationRef.current) return
          requestedTokensRef.current.delete(seg.seq)
          queueTokenUpdate(seg.seq, result)
        })
      }
      // 缓存命中也走同一帧批处理，避免滚动期间单独触发一次重渲染。
      for (const [seq, tk] of cachedHits) queueTokenUpdate(seq, tk)
    },
    [segments, mode, queueTokenUpdate, tokens]
  )

  // 切换 A/B/C：清空当前 tokens 视图，并**立即重分上次视口区间**——否则词框全消失、
  // 直到用户滚动触发 rangeChanged 才恢复（缓存按 (seq,mode) 分键，旧 mode 缓存不干扰）。
  // 只依赖 mode：首次挂载不重分（此时无 tokens 可丢）；segments/章切换由各自 effect 负责。
  const modeRef = useRef(mode)
  useEffect(() => {
    if (modeRef.current === mode) return
    modeRef.current = mode
    resetTokens()
    const [lo, hi] = lastRangeRef.current
    // 下个微任务再分：让 segments/tokens 状态先落位（同 tick 内 tokenizeRange 读到旧 segments 无妨，
    // 但稳妥起见延一拍，避免与本章 segments 更新交错）。
    void Promise.resolve().then(() => tokenizeRangeRef.current(lo, hi))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const tokenizeRangeRef = useRef(tokenizeRange)
  tokenizeRangeRef.current = tokenizeRange

  return {
    chapters,
    chapterIndex,
    segments,
    tokens,
    loading,
    dictError,
    goToChapter,
    tokenizeRange
  }
}
