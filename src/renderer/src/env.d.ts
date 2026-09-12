/// <reference types="vite/client" />

// window.chion 的类型（契约 4 的 preload 门，见 src/preload/index.ts）。
// 借用 preload 已导出的 ChionApi，避免在 renderer 侧重复定义。
import type { ChionApi } from '../../preload'

declare global {
  interface Window {
    chion: ChionApi
  }
}

export {}
