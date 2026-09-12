// library 模块公开面（依赖契约 4 + CR-1 扩展）。职责：书架、打开书、阅读进度 UI。
// 书架/阅读器路由在 App.tsx 接线（见 App.tsx）。
export { Library } from './Library'
export { ReaderScreen } from './ReaderScreen'
export { useLibrary } from './useLibrary'
export {
  importReducer,
  initialImportState,
  type ImportState,
  type ImportEvent
} from './import-flow'
