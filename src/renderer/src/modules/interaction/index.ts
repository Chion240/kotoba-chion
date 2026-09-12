// interaction 模块公开面（依赖契约 3）。职责：点词/选择/快捷键 → 剪贴板 + 暂存。
// 交互模型见 V3_MASTER_PLAN.md 第 5 节；概念见 CONTEXT.md「暂存输入 / 选择」。
export { useInteraction } from './useInteraction'
export { StagedInputBox } from './StagedInputBox'
export {
  getStaged,
  subscribe as subscribeStaged,
  clearStaged,
  setUserText,
  stageSelection,
  stageAuto,
  type Staged
} from './staged-store'
export { writeClipboard } from './clipboard'
export type { Selection } from './selection'
export {
  defaultKeybindings,
  matchAction,
  eventCombo,
  type Keybindings,
  type Action
} from './keybindings'
export {
  getKeybindings,
  setKeybinding,
  resetKeybindings,
  useKeybindings,
  coerceKeybindings,
  subscribe as subscribeKeybindings
} from './keybindings-store'
