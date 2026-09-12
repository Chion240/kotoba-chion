import { useCallback, useEffect, useRef } from 'react'
import type { Token } from '../../../../worker/contract'
import {
  accumulate,
  segmentItem,
  selectionText,
  toSelection,
  wordItem,
  type GestureItem
} from './selection'
import { writeClipboard } from './clipboard'
import { stageSelection } from './staged-store'

// interaction 接线 hook：点词/右键选段 → 写剪贴板 + 暂存（总纲第 5 节）。
// 由 reader-view 的 Reader 挂载（必要接线），不改 reader-view 内部逻辑。
// segTextBySeq: 供右键选段时按 seq 取整段原文（Reader 从 segments 提供）。
export function useInteraction(segTextBySeq: (seq: number) => string | undefined): {
  onTokenClick: (seq: number, tokenIdx: number, token: Token) => void
  onSegmentContextMenu: (e: React.MouseEvent) => void
} {
  // 手势缓冲：shift 累加只在同一手势内；非 shift 覆盖（总纲第 5 节）。
  const bufferRef = useRef<GestureItem[]>([])
  // 全局 shift 态：token onClick 不带事件，靠此还原 shift+左键=多选词。
  const shiftRef = useRef(false)

  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.key === 'Shift') shiftRef.current = true
    }
    const up = (e: KeyboardEvent): void => {
      if (e.key === 'Shift') shiftRef.current = false
    }
    // 按住 shift 时 Alt+Tab 切走，keyup 落在别的窗口，shiftRef 会卡在 true，
    // 回来后第一次单击被误当多选累加。失焦即复位。
    const reset = (): void => {
      shiftRef.current = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', reset)
    }
  }, [])

  // 一次选择手势的收尾：累加 → 造契约 3 Selection → 写剪贴板 且 填暂存。
  const commit = useCallback((item: GestureItem, shift: boolean) => {
    bufferRef.current = accumulate(bufferRef.current, item, shift)
    const sel = toSelection(bufferRef.current)
    if (!sel) return
    const text = selectionText(sel)
    void writeClipboard(text) // 剪贴板永远写（喂 GoldenDict），不受草稿保护
    stageSelection(sel, text) // 暂存受覆盖语义 + 草稿保护约束
  }, [])

  // 左键单击词 → 原形进剪贴板 + 暂存；shift+左键 = 多选词（表层形，见 accumulate/toSelection）。
  const onTokenClick = useCallback(
    (seq: number, _tokenIdx: number, token: Token) => {
      commit(wordItem(seq, token), shiftRef.current)
    },
    [commit]
  )

  // 右键单击段 → 整段原文 → 剪贴板 + 暂存；shift+右键 = 多选段。
  const onSegmentContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('.reader-seg')
      const seqAttr = el?.dataset.seq
      if (!el || seqAttr === undefined) return
      const seq = Number(seqAttr)
      const jp = segTextBySeq(seq)
      if (jp === undefined) return
      e.preventDefault() // 抑制系统右键菜单
      commit(segmentItem(seq, jp), e.shiftKey)
    },
    [commit, segTextBySeq]
  )

  return { onTokenClick, onSegmentContextMenu }
}
