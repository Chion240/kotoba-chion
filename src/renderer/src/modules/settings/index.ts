// settings 模块公开面（渲染层）。职责：CSS 变量驱动的统一设置面板 + 设置 store（单一真值）+ 字体导入（CR-4）。
// 决策 A：所有值写成 CSS 自定义属性挂 document.documentElement，消费方 CSS 用 var(--x, 默认) 读。
export { SettingsDialog } from './SettingsDialog'
export {
  useSettings,
  getSettings,
  setSetting,
  applySettings,
  subscribe
} from './settings-store'
export type {
  Settings,
  Mode,
  Theme,
  TokenStyle
} from './settings-logic'
