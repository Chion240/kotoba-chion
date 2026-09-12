import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import {
  PanelLeft,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Settings,
  Sparkles,
  Search
} from 'lucide-react'
import type { TokenizeReq } from '../../../../worker/contract'
import { useReader } from './useReader'
import type { SegmentTokenStore } from './segment-token-store'
import type { Token } from '../../../../worker/contract'
import { TokenizedSegment } from './TokenizedSegment'
import { chapterLabel } from './chapter-nav'
import { toggleHoveredZh, clampWidth } from './reader-logic'
import { useInteraction, writeClipboard, stageAuto, matchAction, getKeybindings } from '../interaction'
import { AIPanel } from '../ai-analysis'
import { shouldTranslate, translate } from '../ai-translation'
import { useSettings, SettingsDialog } from '../settings'
import { PlaybackBar, useVoiceProfiles, getPlayback, playSingle, usePlayback, useContinuousReading } from '../tts'
import { useReaderSearch, type ReaderSearchResult } from './reader-search'
import { ReaderSearchPanel } from './ReaderSearchPanel'
import './reader.css'

type Mode = TokenizeReq['mode']

// 面板宽度夹取边界（px；会话 9.1 任务书：左栏 10–28rem、右栏 14–40rem，1rem=16px）。
const TOC_MIN = 160
const TOC_MAX = 448
const PANEL_MIN = 224
const PANEL_MAX = 640

// 拖拽调面板宽：state 驱动 + localStorage 持久化。side=拖柄相对面板的方位（left=柄在面板右侧）。
function usePanelWidth(
  key: string,
  fallback: number,
  min: number,
  max: number,
  side: 'left' | 'right'
): [number, (e: React.PointerEvent) => void] {
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem(key))
    return saved ? clampWidth(saved, min, max) : fallback
  })
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startW = width
      const onMove = (ev: PointerEvent): void => {
        // left 柄：向右拖变宽；right 柄：向左拖变宽。
        const delta = side === 'left' ? ev.clientX - startX : startX - ev.clientX
        setWidth(clampWidth(startW + delta, min, max))
      }
      const onUp = (): void => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        setWidth((w) => {
          localStorage.setItem(key, String(w))
          return w
        })
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [width, key, min, max, side]
  )
  return [width, onPointerDown]
}

// reader-view 主组件：按章加载（根治白屏）+ 左侧目录 + 右侧面板 + 上下章导航（会话 9 重构）。
// 三栏布局：左目录（可收起）｜中阅读区（Virtuoso 只挂视口内，总纲第 5、7 节）｜右面板（可收起，含暂存框）。
// library 会话接线（可选 props，默认值向后兼容）：initialSeq 恢复上次位置；onProgress 上报顶段 seq；onBack 返回书架。
export function Reader({
  bookId,
  kind = 'bilingual',
  initialSeq = 0,
  onProgress,
  onBack
}: {
  bookId: number
  // 书级安全门（会话 15）：kind==='jp' 才允许 AI 译文；默认 'bilingual'（最安全：不知道就不翻译）。
  kind?: 'bilingual' | 'jp'
  initialSeq?: number
  onProgress?: (seq: number) => void
  onBack?: () => void
}): React.JSX.Element {
  // 会话 12：mode/furigana/allZh 从 settings store 读（单一真值，直读不镜像）。从此持久化沿用上次（用户已同意）。
  const settings = useSettings()
  const mode: Mode = settings.mode
  const {
    chapters,
    chapterIndex,
    segments,
    tokens,
    loading,
    dictError,
    goToChapter,
    tokenizeRange
  } =
    useReader(bookId, mode, initialSeq)

  const [openZh, setOpenZh] = useState<Set<number>>(new Set())
  const [tocOpen, setTocOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false) // ⚙ 设置面板开合
  const [toolPanel, setToolPanel] = useState<'search' | null>(null)
  const [visibleSeq, setVisibleSeq] = useState<number | null>(initialSeq > 0 ? initialSeq : null)
  const visibleSeqRef = useRef<number | null>(initialSeq > 0 ? initialSeq : null)
  const scrollingRef = useRef(false)
  const pendingProgressSeqRef = useRef<number | null>(null)
  const pendingSeqRef = useRef<number | null>(null)
  // 左右面板宽度可拖拽调（会话 9.1）；state 驱动 + 存 localStorage 下次恢复。
  const [tocWidth, dragToc] = usePanelWidth('reader-toc-width', 240, TOC_MIN, TOC_MAX, 'left')
  const [panelWidth, dragPanel] = usePanelWidth(
    'reader-panel-width',
    352,
    PANEL_MIN,
    PANEL_MAX,
    'right'
  )
  const focusedIdxRef = useRef(0)
  const hoveredSeqRef = useRef<number | null>(null) // 鼠标当前悬停段 seq（t 键作用对象，会话 9.1）
  // t 键 handler 只挂一次（空 deps）；用 ref 让它读到最新 segments/kind/activeProfile，避免陈旧闭包。
  const segmentsRef = useRef(segments)
  segmentsRef.current = segments
  const kindRef = useRef(kind)
  kindRef.current = kind
  // 翻章快捷键（会话 18）：handler 空 deps 只挂一次，用 ref 读最新 chapterIndex/changeChapter，避免陈旧闭包。
  const chapterIndexRef = useRef(chapterIndex)
  chapterIndexRef.current = chapterIndex
  const chaptersLenRef = useRef(chapters.length)
  chaptersLenRef.current = chapters.length
  const changeChapterRef = useRef<(idx: number) => void>(() => {})
  const virtuoso = useRef<VirtuosoHandle>(null)
  // 首屏进度恢复：只在初次载入该书的起始章后，scrollToIndex 到章内偏移（决策 3，大概位置即可）。
  const restoredRef = useRef(false)
  const curChapter = chapters[chapterIndex]
  const search = useReaderSearch(bookId, chapters)

  // interaction 接线（会话 7）：右键选段按 seq 取整段原文（DOM token 含 ruby 读音，故从数据取）。
  const segTextBySeq = useCallback(
    (seq: number) => segments.find((s) => s.seq === seq)?.jp_text,
    [segments]
  )
  const { onTokenClick: baseTokenClick, onSegmentContextMenu: baseSegmentContextMenu } =
    useInteraction(segTextBySeq)

  // TTS 声音档案（会话 17）：activeProfile 供给点击即播。用 ref 避免包裹回调陈旧闭包。
  const voice = useVoiceProfiles()
  const voiceProfileRef = useRef(voice.activeProfile)
  voiceProfileRef.current = voice.activeProfile
  const playback = usePlayback() // 连读态：currentSeq 驱动高亮

  // 连读段开始：同步当前段到剪贴板 & AI 暂存框（新段覆盖旧段，不叠加；stageAuto 无条件覆盖）。
  // 滚屏跟随由下方 currentSeq effect 驱动（比在此命令式 scrollToIndex 更稳，不受渲染时序影响）。
  // 译文不自动出——按 t 才翻当前朗读段（一次性，见下方 t 键 handler）。
  const onSegStart = useCallback(
    (seg: import('../../../../shared/contracts').Segment) => {
      void writeClipboard(seg.jp_text)
      stageAuto(seg.jp_text)
    },
    []
  )

  // 连读编排（会话 17 Phase 2）：推进/预取/自动翻章/跳转。
  const reading = useContinuousReading({
    segments,
    chapters,
    chapterIndex,
    goToChapter,
    virtuosoRef: virtuoso,
    activeProfile: voice.activeProfile,
    onSegStart,
    focusedIdxRef
  })

  // 连读滚屏跟随（词典笔式「读到哪跟到哪」）：currentSeq 变 → 该段滚到视口居中。
  // 用 effect 而非命令式 scrollToIndex，确保数据源一致、时序稳（渲染完再滚）。
  useEffect(() => {
    if (playback.currentSeq == null) return
    const idx = segments.findIndex((s) => s.seq === playback.currentSeq)
    if (idx >= 0) virtuoso.current?.scrollToIndex({ index: idx, align: 'center', behavior: 'auto' })
  }, [playback.currentSeq, segments])

  // 朗读模式 ON 时：点词/点段在原交互（剪贴板+暂存）之外，同时触发朗读（用户明确要「同时触发」）。
  // 左键=读该词（与复制范围一致）；右键=读整段（与复制范围一致）。合成前经 synthesize 入口的 normalizeForTts 规整。
  const onTokenClick = useCallback(
    (seq: number, tokenIdx: number, token: import('../../../../worker/contract').Token) => {
      baseTokenClick(seq, tokenIdx, token) // 原交互（剪贴板+暂存）永远保留，方便查词
      const pb = getPlayback()
      if (!pb.enabled) return
      if (pb.reading) reading.jumpTo(seq) // 连读中点词=跳到该段继续连读
      else void playSingle(voiceProfileRef.current, token.surface) // 否则单词即播
    },
    [baseTokenClick, reading]
  )

  const onSegmentContextMenu = useCallback(
    (e: React.MouseEvent) => {
      baseSegmentContextMenu(e)
      const pb = getPlayback()
      if (!pb.enabled) return
      const el = (e.target as HTMLElement).closest<HTMLElement>('.reader-seg')
      const seqAttr = el?.dataset.seq
      if (seqAttr === undefined) return
      const seq = Number(seqAttr)
      if (pb.reading) { reading.jumpTo(seq); return } // 连读中右键=跳到该段继续
      const jp = segmentsRef.current.find((s) => s.seq === seq)?.jp_text
      if (jp) void playSingle(voiceProfileRef.current, jp)
    },
    [baseSegmentContextMenu, reading]
  )

  const publishProgress = useCallback((seq: number) => {
    if (visibleSeqRef.current !== seq) {
      visibleSeqRef.current = seq
      startTransition(() => setVisibleSeq(seq))
    }
    onProgress?.(seq)
  }, [onProgress])

  const flushAfterScroll = useCallback(() => {
    const seq = pendingProgressSeqRef.current
    pendingProgressSeqRef.current = null
    if (seq != null) publishProgress(seq)
  }, [publishProgress])

  const onScrolling = useCallback((isScrolling: boolean) => {
    if (scrollingRef.current === isScrolling) return
    scrollingRef.current = isScrolling
    if (!isScrolling) flushAfterScroll()
  }, [flushAfterScroll])

  const onRangeChanged = useCallback(
    (r: { startIndex: number; endIndex: number }) => {
      focusedIdxRef.current = r.startIndex
      tokenizeRange(r.startIndex, r.endIndex)
      // 进度上报：当前顶段全局 seq（library 侧防抖 saveProgress）。存 seq 即可推出章 + 章内位置（决策 3）。
      const seg = segments[r.startIndex]
      if (seg) {
        if (scrollingRef.current) pendingProgressSeqRef.current = seg.seq
        else publishProgress(seg.seq)
      }
    },
    [publishProgress, segments, tokenizeRange]
  )

  // 段就绪后定位：首次到起始章 → 恢复到 initialSeq 的章内偏移；之后切章 → 滚到章首。
  useEffect(() => {
    if (loading || segments.length === 0 || !curChapter) return
    if (!restoredRef.current) {
      restoredRef.current = true
      const offset = Math.max(0, Math.min(segments.length - 1, initialSeq - curChapter.startSeq))
      if (offset > 0) virtuoso.current?.scrollToIndex({ index: offset, align: 'start' })
    }
    tokenizeRange(0, 20) // 冷启动先分词首屏（rangeChanged 可能未触发）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, segments, curChapter])

  useEffect(() => {
    const seq = pendingSeqRef.current
    if (loading || seq == null || !curChapter || !segments.length) return
    const index = segments.findIndex((segment) => segment.seq === seq)
    if (index >= 0) virtuoso.current?.scrollToIndex({ index, align: 'center' })
    pendingSeqRef.current = null
  }, [curChapter, loading, segments])

  const changeChapter = useCallback(
    (idx: number) => {
      goToChapter(idx)
      focusedIdxRef.current = 0
      virtuoso.current?.scrollToIndex({ index: 0, align: 'start' })
    },
    [goToChapter]
  )
  changeChapterRef.current = changeChapter

  const navigateToSeq = useCallback(
    (seq: number, targetChapterIndex?: number) => {
      const nextChapterIndex = targetChapterIndex ?? chapters.findIndex(
        (chapter) => seq >= chapter.startSeq && seq <= chapter.endSeq
      )
      if (nextChapterIndex < 0) return
      if (nextChapterIndex === chapterIndex) {
        const index = segments.findIndex((segment) => segment.seq === seq)
        if (index >= 0) virtuoso.current?.scrollToIndex({ index, align: 'center' })
        return
      }
      pendingSeqRef.current = seq
      changeChapter(nextChapterIndex)
    },
    [chapterIndex, chapters, changeChapter, segments]
  )

  const onSearchNavigate = useCallback((result: ReaderSearchResult) => {
    navigateToSeq(result.seq, result.chapterIndex)
  }, [navigateToSeq])

  const onSegmentHover = useCallback((seq: number | null) => {
    hoveredSeqRef.current = seq
  }, [])

  // t 键：切「鼠标悬停段」的译文（会话 9.1 —— 改用悬停段而非视口顶段；空悬停不响应，防误触）。
  // 会话 15：命中段先 toggle 展开态（中文一到就显示），再走安全门——纯日语书 + 无内置/已落库 zh_text
  // 才发起 AI 译文（shouldTranslate 把守，双语书恒不翻，铁律 3）。translate 内部去重防重发。
  // 可自定义快捷键（会话 18）：切译文 / 上一章 / 下一章。handler 空 deps 挂一次，
  // getKeybindings() 每次事件现读（模块级 store，无陈旧闭包）；chapterIndex/changeChapter 走 ref。
  // 守卫（会话 19 修）：
  //   - 设置对话框打开时不响应——否则在设置里按 →/t 会穿透去切章/切译文（Radix Tabs 也用方向键）。
  //   - 不再硬拦 ctrl/alt/shift 修饰键：用户可绑定修饰组合（如 ctrl+arrowleft），由 matchAction 决定命中。
  const settingsOpenRef = useRef(settingsOpen)
  settingsOpenRef.current = settingsOpen
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      // 守卫：在 AI 输入框（textarea/input）打字时，翻章/t 都跳过，防箭头键翻章/t 误触。
      const el = e.target as HTMLElement
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT')) return
      // 守卫：设置对话框打开（焦点在其内部）时不响应，防方向键/t 穿透到阅读器。
      if (settingsOpenRef.current) return
      const action = matchAction(getKeybindings(), e)
      if (action === null) return
      // AI 面板挂载时由 StagedInputBox 的全局监听处理；面板收起时不响应。
      if (action === 'sendToAi') return
      e.preventDefault()
      if (action === 'prevChapter') {
        if (chapterIndexRef.current > 0) changeChapterRef.current(chapterIndexRef.current - 1)
        return
      }
      if (action === 'nextChapter') {
        if (chapterIndexRef.current < chaptersLenRef.current - 1)
          changeChapterRef.current(chapterIndexRef.current + 1)
        return
      }
      // toggleTranslation：连读中作用于「当前朗读段」（一次性切该句译文，无需悬停，会话 17）；
      // 非连读作用于「鼠标悬停段」（会话 9.1）。空目标不响应，防误触。
      const pb = getPlayback()
      const seq = pb.reading ? pb.currentSeq : hoveredSeqRef.current
      setOpenZh((prev) => toggleHoveredZh(prev, seq))
      if (seq == null) return
      const seg = segmentsRef.current.find((s) => s.seq === seq)
      if (seg && shouldTranslate(kindRef.current, seg)) {
        void translate(seg.id, seg.jp_text)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // AI 译文错误重试（会话 15）：store error 态允许重发（连接读独立翻译配置）。
  const onRetryTranslate = useCallback(
    (seg: import('../../../../shared/contracts').Segment) => {
      void translate(seg.id, seg.jp_text)
    },
    []
  )

  const hasPrev = chapterIndex > 0
  const hasNext = chapterIndex < chapters.length - 1
  const lastSeq = chapters.at(-1)?.endSeq ?? 0
  const progress = lastSeq > 0 && visibleSeq != null
    ? Math.max(0, Math.min(100, (visibleSeq / lastSeq) * 100))
    : 0
  return (
    <div className="reader-root">
      <ReaderToolbar
        tocOpen={tocOpen}
        onToc={() => setTocOpen((v) => !v)}
        panelOpen={panelOpen}
        onPanel={() => setPanelOpen((v) => !v)}
        onSettings={() => setSettingsOpen(true)}
        chapterTitle={curChapter ? chapterLabel(curChapter, chapterIndex) : ''}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPrev={() => changeChapter(chapterIndex - 1)}
        onNext={() => changeChapter(chapterIndex + 1)}
        onBack={onBack}
        onReadingStart={() => reading.start()}
        onReadingStop={() => reading.stop()}
        searchOpen={toolPanel === 'search'}
        onSearch={() => setToolPanel((value) => value === 'search' ? null : 'search')}
      />
      <div className="reader-progress" aria-label={`阅读进度 ${Math.round(progress)}%`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      {dictError && (
        <div className="reader-dict-error" role="alert">
          分词词典加载失败：{dictError}（日文将降级为纯文本显示）
        </div>
      )}
      <div className="reader-body">
        {toolPanel === 'search' && (
          <ReaderSearchPanel
            query={search.query}
            onQuery={search.setQuery}
            results={search.results}
            searching={search.searching}
            onNavigate={onSearchNavigate}
            onClose={() => setToolPanel(null)}
          />
        )}
        {tocOpen && (
          <div className="reader-toc-layer" style={{ width: tocWidth }}>
            <TocSidebar
              chapters={chapters}
              activeIdx={chapterIndex}
              onPick={changeChapter}
            />
            <div
              className="reader-resizer"
              onPointerDown={dragToc}
              title="拖拽调整目录宽度"
            />
          </div>
        )}
        <div className="reader-list-wrap" onContextMenu={onSegmentContextMenu}>
          {loading ? (
            <div className="reader-loading">
              <span className="reader-spinner" aria-hidden />
              载入本章…
            </div>
          ) : settings.layout === 'vertical' ? (
            <VerticalReader
              segments={segments}
              tokenStore={tokens}
              openZh={openZh}
              settings={settings}
              playback={playback}
              onTokenClick={onTokenClick}
              onHover={onSegmentHover}
              onRetry={onRetryTranslate}
              hasNext={hasNext}
              onNext={() => changeChapter(chapterIndex + 1)}
              nextTitle={hasNext ? chapterLabel(chapters[chapterIndex + 1], chapterIndex + 1) : ''}
            />
          ) : (
            <Virtuoso
              ref={virtuoso}
              className="reader-list"
              data={segments}
              rangeChanged={onRangeChanged}
              isScrolling={onScrolling}
              increaseViewportBy={{ top: 120, bottom: 180 }}
              components={{
                Footer: () =>
                  hasNext ? (
                    <div className="reader-chapter-end">
                      <button className="reader-nav-btn" onClick={() => changeChapter(chapterIndex + 1)}>
                        下一章：{chapterLabel(chapters[chapterIndex + 1], chapterIndex + 1)} →
                      </button>
                    </div>
                  ) : (
                    <div className="reader-chapter-end reader-book-end">— 全书完 —</div>
                  )
              }}
              itemContent={(_i, seg) => (
                <TokenizedSegment
                  seg={seg}
                  tokenStore={tokens}
                  showZh={settings.allZh || openZh.has(seg.seq)}
                  showFurigana={settings.furigana}
                  isSpeaking={playback.currentSeq === seg.seq}
                  onTokenClick={onTokenClick}
                  onHover={onSegmentHover}
                  onRetry={onRetryTranslate}
                />
              )}
            />
          )}
        </div>
        {panelOpen && (
          <>
            <div
              className="reader-resizer"
              onPointerDown={dragPanel}
              title="拖拽调整面板宽度"
            />
            <aside className="reader-panel" style={{ width: panelWidth }}>
              {/* 会话 10：AI 分析面板（内部渲 StagedInputBox）—— 流式多轮 + 多档案 + 到 done 存档。 */}
              <AIPanel />
            </aside>
          </>
        )}
      </div>
    </div>
  )
}

// 竖排阅读器独立渲染层：不复用 Virtuoso 的纵向测量，避免横排虚拟列表破坏 writing-mode。
// 竖排正文使用原生横向滚动，保留选取、分词点击、译文展开和朗读高亮。
function VerticalReader({ segments, tokenStore, openZh, settings, playback, onTokenClick, onHover, onRetry, hasNext, onNext, nextTitle }: {
  segments: import('../../../../shared/contracts').Segment[]
  tokenStore: SegmentTokenStore
  openZh: Set<number>
  settings: ReturnType<typeof useSettings>
  playback: ReturnType<typeof usePlayback>
  onTokenClick: (seq: number, tokenIdx: number, token: Token) => void
  onHover: (seq: number | null) => void
  onRetry: (seg: import('../../../../shared/contracts').Segment) => void
  hasNext: boolean
  onNext: () => void
  nextTitle: string
}): React.JSX.Element {
  return (
    <div className="reader-vertical-flow">
      {segments.map((seg) => (
        <TokenizedSegment key={seg.id} seg={seg} tokenStore={tokenStore}
          showZh={settings.allZh || openZh.has(seg.seq)} showFurigana={settings.furigana}
          isSpeaking={playback.currentSeq === seg.seq} onTokenClick={onTokenClick}
          onHover={onHover} onRetry={onRetry} />
      ))}
      <div className="reader-chapter-end reader-vertical-chapter-end">
        {hasNext ? <button className="reader-nav-btn" onClick={onNext}>下一章：{nextTitle} →</button> : '— 全书完 —'}
      </div>
    </div>
  )
}

// 左侧目录：全列各章（决策 1），空标题由 chapterLabel 补占位；点击跳该章。
function TocSidebar({
  chapters,
  activeIdx,
  onPick
}: {
  chapters: import('../../../../shared/contracts').ChapterMeta[]
  activeIdx: number
  onPick: (idx: number) => void
}): React.JSX.Element {
  return (
    <nav className="reader-toc">
      <div className="reader-toc-title">目录 · {chapters.length} 章</div>
      <ul className="reader-toc-list">
        {chapters.map((ch, i) => (
          <li key={ch.id}>
            <button
              className={i === activeIdx ? 'reader-toc-item is-active' : 'reader-toc-item'}
              onClick={() => onPick(i)}
            >
              <span className="reader-toc-num">{i + 1}</span>
              <span className="reader-toc-label">{chapterLabel(ch, i)}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// 会话 12：工具栏只留「操作」——目录/返回/上下章/章名/⚙设置/AI 面板。
// 所有「设置」（mode/furigana/allZh/词距/词框色…）搬进 SettingsDialog（由 settings store 供给）。
function ReaderToolbar(p: {
  tocOpen: boolean
  onToc: () => void
  panelOpen: boolean
  onPanel: () => void
  onSettings: () => void
  chapterTitle: string
  hasPrev: boolean
  hasNext: boolean
  onPrev: () => void
  onNext: () => void
  onBack?: () => void
  onReadingStart: () => void
  onReadingStop: () => void
  searchOpen: boolean
  onSearch: () => void
}): React.JSX.Element {
  return (
      <div className="reader-toolbar">
        <div className="reader-toolbar-primary">
          {p.onBack && (
            <button className="reader-toolbar-back" onClick={p.onBack} title="返回书架">
              <ArrowLeft size={15} />
              <span>书架</span>
            </button>
          )}
          <button
            className={p.tocOpen ? 'reader-mode-btn is-active' : 'reader-mode-btn'}
            onClick={p.onToc}
            title="目录"
            aria-pressed={p.tocOpen}
          >
            <PanelLeft size={14} /> <span>目录</span>
          </button>
          {/* 会话 17：朗读模式开关 + ▶朗读全文。ON 时点词/点段同时触发朗读；连读=按段推进+预取+自动翻章。 */}
          <PlaybackBar onStart={p.onReadingStart} onStop={p.onReadingStop} />
          <div className="reader-toolbar-chapter">
            <button className="reader-nav-btn" onClick={p.onPrev} disabled={!p.hasPrev} title="上一章">
              <ChevronLeft size={14} />
            </button>
            <span className="reader-chapter-name">{p.chapterTitle || '载入中'}</span>
            <button className="reader-nav-btn" onClick={p.onNext} disabled={!p.hasNext} title="下一章">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
        <div className="reader-toolbar-secondary">
          <button className={p.searchOpen ? 'reader-mode-btn is-active' : 'reader-mode-btn'} onClick={p.onSearch} title="全文搜索" aria-pressed={p.searchOpen}>
            <Search size={14} /> <span>搜索</span>
          </button>
          <button className="reader-mode-btn" onClick={p.onSettings} title="设置">
            <Settings size={14} /> <span>设置</span>
          </button>
          <button
            className={p.panelOpen ? 'reader-mode-btn is-active' : 'reader-mode-btn'}
            onClick={p.onPanel}
            title="AI 面板"
            aria-pressed={p.panelOpen}
          >
            <Sparkles size={14} /> <span>AI</span>
          </button>
        </div>
      </div>
  )
}
