// library · 导入流程状态机（纯逻辑，无 React/electron —— 便于独立自测，铁律 4）。
// 流程：idle → 选文件 → 选 mode(双语/纯日语，决策 6 不自动判) → importing → done/error。
// 失败（损坏 epub，会话 4 说会 reject）落 error 态，UI 提示。

export type ImportState =
  | { status: 'idle' }
  | { status: 'choosing'; path: string } // 已选文件，等用户选 mode
  | { status: 'importing'; path: string; mode: 'bilingual' | 'jp' }
  | { status: 'error'; message: string }

export type ImportEvent =
  | { type: 'filePicked'; path: string | null } // null = 用户取消选择器
  | { type: 'cancel' } // 关对话框 / 放弃
  | { type: 'modeChosen'; mode: 'bilingual' | 'jp' }
  | { type: 'succeeded' }
  | { type: 'failed'; message: string }

// 纯 reducer：当前态 + 事件 → 新态。非法转移原样返回（防御）。
export function importReducer(state: ImportState, ev: ImportEvent): ImportState {
  switch (ev.type) {
    case 'filePicked':
      // 只在 idle/error 起步；取消（null）回 idle。
      if (state.status !== 'idle' && state.status !== 'error') return state
      return ev.path ? { status: 'choosing', path: ev.path } : { status: 'idle' }
    case 'modeChosen':
      if (state.status !== 'choosing') return state
      return { status: 'importing', path: state.path, mode: ev.mode }
    case 'succeeded':
      if (state.status !== 'importing') return state
      return { status: 'idle' }
    case 'failed':
      return { status: 'error', message: ev.message }
    case 'cancel':
      return { status: 'idle' }
    default:
      return state
  }
}

export const initialImportState: ImportState = { status: 'idle' }
