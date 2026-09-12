import type { Selection } from './selection'

// 暂存输入 store（CONTEXT.md「暂存输入」）：选择的产物填入 AI 输入框但未发送。
// 单一真值，供 StagedInputBox 订阅显示、useInteraction 写入。
// 真正的 AI 分析会话是后续 ai-analysis 会话的事，本模块只喂暂存 + 留发送接口。
export type StagedOrigin = 'auto' | 'user'

export type Staged = {
  text: string
  origin: StagedOrigin // auto=选择自动填；user=用户手打（草稿保护）
  selection: Selection | null // 最近一次选择的契约 3 产物（发送时可带上）
}

const EMPTY: Staged = { text: '', origin: 'auto', selection: null }

let state: Staged = EMPTY
const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

// 选择自动填入暂存（覆盖语义 + 草稿保护，总纲第 5 节）：
// - 覆盖：新选择覆盖上一次暂存的 auto 文本，绝不叠加。
// - 草稿保护：框里已有用户手打内容（origin==='user' 且非空）时，不覆盖文本。
//   （selection 元数据仍更新，剪贴板由调用方另写——写剪贴板永不受草稿保护限制。）
export function stageSelection(sel: Selection, text: string): void {
  const protectedDraft = state.origin === 'user' && state.text.trim().length > 0
  state = protectedDraft
    ? { ...state, selection: sel }
    : { text, origin: 'auto', selection: sel }
  emit()
}

// 用户在输入框手打：标记为 user（触发草稿保护）。空串回落到可自动填。
export function setUserText(text: string): void {
  state = { text, origin: text.length > 0 ? 'user' : 'auto', selection: state.selection }
  emit()
}

// 无条件覆盖暂存文本、origin=auto（连读同步用：每读到一段覆盖上一段，不叠加、不触发草稿保护）。
// 与 stageSelection 区别：不受草稿保护约束（连读跟随朗读，明确要覆盖）；不带 selection 元数据。
export function stageAuto(text: string): void {
  state = { text, origin: 'auto', selection: null }
  emit()
}

// 发送后 / 手动清空：暂存归零，回到可自动填。
export function clearStaged(): void {
  state = EMPTY
  emit()
}

export function getStaged(): Staged {
  return state
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
