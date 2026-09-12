import type { Token } from '../../../../worker/contract'

// 契约 3（Selection）的落地。见 V3_MASTER_PLAN.md 第 4、5 节。
// 这是 interaction → 剪贴板 + AI 输入暂存 的产物真值，勿在别处重复定义。
export type Selection = {
  kind: 'word' | 'segment'
  surface: string // shift 多选词用表层形（选什么是什么）
  dictionaryForm?: string // 仅"单击点词"用原形
  seqs: number[]
}

// 手势缓冲的一项：一次点击/选段的原子产物。
// shift 累加只在同一次手势内（总纲第 5 节），非 shift 点击清空缓冲重开。
export type GestureItem = {
  kind: 'word' | 'segment'
  surface: string
  dictionaryForm?: string
  seq: number
}

// 从一个 token 造词项：原形空/异常兜底表层形（总纲第 5 节点词兜底）。
export function wordItem(seq: number, token: Token): GestureItem {
  const df = token.dictionaryForm?.trim()
  return {
    kind: 'word',
    surface: token.surface,
    dictionaryForm: df || undefined, // 空则不带，取文本时兜底表层
    seq
  }
}

// 从一段造段项：整段原文（右键选段）。
export function segmentItem(seq: number, jpText: string): GestureItem {
  return { kind: 'segment', surface: jpText, seq }
}

// 手势累加：shift 且同类型 → 追加；否则（非 shift / 换类型）→ 新手势覆盖。
// 返回新缓冲（不可变），绝不叠加跨手势（总纲第 5 节覆盖语义）。
export function accumulate(
  buffer: GestureItem[],
  item: GestureItem,
  shift: boolean
): GestureItem[] {
  const sameKind = buffer.length > 0 && buffer[0].kind === item.kind
  if (shift && sameKind) return [...buffer, item]
  return [item]
}

// 缓冲 → 契约 3 Selection。
// 单个词：带原形（喂 GoldenDict）；多词/段：只表层，seqs 去重保序。
export function toSelection(buffer: GestureItem[]): Selection | null {
  if (buffer.length === 0) return null
  const kind = buffer[0].kind
  const surface = buffer.map((b) => b.surface).join(kind === 'segment' ? '\n' : '')
  const seqs = [...new Set(buffer.map((b) => b.seq))]
  const single = buffer.length === 1 && kind === 'word'
  return {
    kind,
    surface,
    dictionaryForm: single ? buffer[0].dictionaryForm : undefined,
    seqs
  }
}

// 选择产物 → 写剪贴板/暂存的文本。
// 单击点词优先原形（GoldenDict 查词根）；多选/段用表层（选什么是什么）。
export function selectionText(sel: Selection): string {
  return sel.dictionaryForm && sel.dictionaryForm.length > 0 ? sel.dictionaryForm : sel.surface
}
