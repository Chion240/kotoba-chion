// 快捷键 store（单一真值，仿 staged-store/settings-store）：模块级 state + useSyncExternalStore。
// 整个 Keybindings 以单键 chion-keybindings 存 localStorage（JSON）。视图直读、不镜像。
// reader-view 事件 handler 直读 getKeybindings()（模块级，无陈旧闭包）；settings KeybindingTab 录制改键。
import { useSyncExternalStore } from 'react'
import { defaultKeybindings, type Action, type Keybindings } from './keybindings'

const STORAGE_KEY = 'chion-keybindings'
const ACTIONS: Action[] = ['toggleTranslation', 'prevChapter', 'nextChapter', 'sendToAi']
const ACTION_CANDIDATES: Record<Action, string[]> = {
  toggleTranslation: ['t', 'ctrl+t', 'alt+t', 'shift+t'],
  prevChapter: ['arrowleft', 'ctrl+arrowleft', 'alt+arrowleft', 'shift+arrowleft'],
  nextChapter: ['arrowright', 'ctrl+arrowright', 'alt+arrowright', 'shift+arrowright'],
  sendToAi: ['ctrl+enter', 'ctrl+shift+enter', 'alt+enter', 'shift+enter', 'meta+enter']
}

// 脏 JSON/缺字段/非法组合 → 逐 action 回落默认；旧数据撞键时保留先出现的绑定，
// 后出现的 action 选自己的首个空闲候选，保证每个动作最终都可触发。
export function coerceKeybindings(raw: unknown): Keybindings {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const out = {} as Keybindings
  const used = new Set<string>()
  for (const a of ACTIONS) {
    const v = obj[a]
    const preferred =
      typeof v === 'string' && v.trim().length > 0
        ? v.toLowerCase().trim()
        : defaultKeybindings[a]
    const combo = used.has(preferred)
      ? ACTION_CANDIDATES[a].find((candidate) => !used.has(candidate)) ?? defaultKeybindings[a]
      : preferred
    out[a] = combo
    used.add(combo)
  }
  return out
}

function load(): Keybindings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return coerceKeybindings(raw ? JSON.parse(raw) : {})
  } catch {
    return { ...defaultKeybindings }
  }
}

let state: Keybindings = load()
const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage 满/禁用：内存态仍更新，忽略持久化失败。
  }
}

export function getKeybindings(): Keybindings {
  return state
}

// 改一个 action 的绑定。撞键检测：新组合已被别的 action 占用 → 返 false 不写（UI 提示）。
export function setKeybinding(action: Action, combo: string): boolean {
  const c = combo.toLowerCase().trim()
  if (!c) return false
  if ((Object.entries(state) as [Action, string][]).some(([a, v]) => a !== action && v === c)) {
    return false
  }
  state = coerceKeybindings({ ...state, [action]: c })
  persist()
  emit()
  return true
}

export function resetKeybindings(): void {
  state = { ...defaultKeybindings }
  persist()
  emit()
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useKeybindings(): Keybindings {
  return useSyncExternalStore(subscribe, getKeybindings)
}
