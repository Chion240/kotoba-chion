// 可自定义快捷键结构（总纲第 5 节）。action → 组合键字符串。matchAction 把 KeyboardEvent 归一化后查表。
// 会话 18：接线 keybindings-store + settings「快捷键」Tab + reader-view / AI 面板消费。
export type Action = 'toggleTranslation' | 'prevChapter' | 'nextChapter' | 'sendToAi'

export type Keybindings = Record<Action, string>

// 默认绑定。组合键格式："mod+key"，mod ∈ {ctrl,alt,shift,meta}，按序拼。
// 翻章用左右箭头（不滚动竖向列表，相对安全）；eventCombo 已 toLowerCase → 'arrowleft'/'arrowright'。
export const defaultKeybindings: Keybindings = {
  toggleTranslation: 't',
  prevChapter: 'arrowleft',
  nextChapter: 'arrowright',
  sendToAi: 'ctrl+enter'
}

// KeyboardEvent → 归一化组合键字符串。
export function eventCombo(e: {
  key: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}): string {
  const parts: string[] = []
  if (e.ctrlKey) parts.push('ctrl')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey) parts.push('shift')
  if (e.metaKey) parts.push('meta')
  parts.push(e.key.toLowerCase())
  return parts.join('+')
}

// 查某事件命中哪个 action（未命中返 null）。
export function matchAction(bindings: Keybindings, e: Parameters<typeof eventCombo>[0]): Action | null {
  const combo = eventCombo(e)
  for (const [action, bound] of Object.entries(bindings) as [Action, string][]) {
    if (bound.toLowerCase() === combo) return action
  }
  return null
}
