// settings · 快捷键分区（会话 18）：三个可自定义快捷键——切译文/上一章/下一章。
// 点「录制」进捕获态，下一个 keydown 归一化写入；撞键提示不写。视图直读 keybindings store。
import { useState } from 'react'
import {
  useKeybindings,
  setKeybinding,
  resetKeybindings,
  eventCombo,
  type Action
} from '../interaction'
import { Button } from '@/components/ui/button'
import { IntegrationSection } from './IntegrationSection'

const ROWS: { action: Action; label: string }[] = [
  { action: 'toggleTranslation', label: '切译文' },
  { action: 'prevChapter', label: '上一章' },
  { action: 'nextChapter', label: '下一章' },
  { action: 'sendToAi', label: '发送给 AI' }
]

export function KeybindingTab(): React.JSX.Element {
  const bindings = useKeybindings()
  const [recording, setRecording] = useState<Action | null>(null)
  const [warn, setWarn] = useState('')

  function onKeyDown(action: Action, e: React.KeyboardEvent): void {
    e.preventDefault()
    e.stopPropagation()
    // Esc 取消录制（防把 Escape 误绑成快捷键，导致以后按 Esc 也触发动作）。
    if (e.key === 'Escape') {
      setWarn('')
      setRecording(null)
      return
    }
    // 纯修饰键单独按下不作为绑定，等实键。
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return
    const combo = eventCombo(e)
    const ok = setKeybinding(action, combo)
    setWarn(ok ? '' : `「${combo}」已被占用`)
    setRecording(null)
  }

  return (
    <>
      {ROWS.map(({ action, label }) => (
        <div key={action} className="settings-field settings-key-row">
          <label>{label}</label>
          <button
            className={recording === action ? 'settings-seg is-active' : 'settings-seg'}
            onClick={() => {
              setWarn('')
              setRecording(action)
            }}
            onKeyDown={recording === action ? (e) => onKeyDown(action, e) : undefined}
          >
            {recording === action ? '按下按键…' : bindings[action]}
          </button>
        </div>
      ))}
      {warn && <div className="settings-hint">{warn}</div>}
      <div className="settings-footer">
        <Button variant="outline" size="sm" onClick={() => resetKeybindings()}>
          恢复默认
        </Button>
      </div>
      <IntegrationSection />
    </>
  )
}
