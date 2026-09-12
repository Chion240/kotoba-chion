// settings store（单一真值，仿 interaction/staged-store.ts）：模块级 store + useSyncExternalStore。
// 视图直读、不镜像。整个 Settings 以单键 chion-settings 存 localStorage（JSON）。
// applySettings 把值写成 CSS 变量挂 document.documentElement + 切 .dark class；订阅 store，变即重刷。
import { useSyncExternalStore } from 'react'
import {
  coerceSettings,
  toCssVars,
  DEFAULT_SETTINGS,
  type Settings
} from './settings-logic'

const STORAGE_KEY = 'chion-settings'

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return coerceSettings(raw ? JSON.parse(raw) : {}) // 脏/缺字段回落默认（coerce 内兜底）
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

let state: Settings = load()
const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

export function getSettings(): Settings {
  return state
}

// 改一个旋钮：coerce 保证落库前合法（夹取/sanitize），写 localStorage，通知订阅者，刷 DOM。
export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  state = coerceSettings({ ...state, [key]: value })
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage 满/禁用：内存态仍更新，忽略持久化失败。
  }
  applySettings(state)
  emit()
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// 应用到 DOM：CSS 变量写根节点（null=移除让 CSS 兜底默认），明暗切 .dark class（index.css 已定义全套）。
export function applySettings(s: Settings): void {
  const root = document.documentElement
  const vars = toCssVars(s)
  for (const [k, v] of Object.entries(vars)) {
    if (v === null) root.style.removeProperty(k)
    else root.style.setProperty(k, v)
  }
  root.dataset.tokenStyle = s.tokenStyle
  root.classList.toggle('dark', s.theme === 'dark')
}

// React 订阅：视图直读 store（单一真值，不复制）。
export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings)
}
