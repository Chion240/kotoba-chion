import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { applySettings, getSettings } from '@/modules/settings'
import './index.css'

// 首帧前先应用持久化设置（.dark class + CSS 变量）：若留到 App 的 useEffect，
// 暗色用户每次启动都会闪一帧白底。
applySettings(getSettings())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
