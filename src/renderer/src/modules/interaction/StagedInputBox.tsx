import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { clearStaged, getStaged, setUserText, subscribe } from './staged-store'
import { matchAction } from './keybindings'
import { getKeybindings } from './keybindings-store'
import './interaction.css'

// 占位的 AI 输入框：显示暂存输入（选择自动填 / 用户手打），留发送接口。
// 真正的 AI 分析会话是 ai-analysis 会话的事——本框只把暂存喂进去、按发送回调交出。
// onSend 交出当前暂存文本（发送后清空）；ai-analysis 会话接此启动流式一轮。
export function StagedInputBox({ onSend }: { onSend?: (text: string) => void }): React.JSX.Element {
  const staged = useSyncExternalStore(subscribe, getStaged)

  const send = useCallback((): void => {
    const text = getStaged().text.trim()
    if (!text) return
    onSend?.(text)
    clearStaged()
  }, [onSend])

  // AIPanel 条件挂载本组件，因此这条监听天然只在 AI 面板打开时存在。
  // 设置对话框里的快捷键录制/输入必须隔离，不能穿透提交暂存内容。
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement | null
      if (target?.closest('[role="dialog"]')) return
      if (matchAction(getKeybindings(), e) !== 'sendToAi') return
      e.preventDefault()
      send()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [send])

  return (
    <div className="staged-box">
      <textarea
        className="staged-input font-reading-jp"
        value={staged.text}
        placeholder="点词 / 右键选段 → 自动填入；也可手打（草稿保护）。"
        onChange={(e) => setUserText(e.target.value)}
      />
      <div className="staged-actions">
        <span className="staged-hint">{staged.origin === 'user' ? '草稿（不覆盖）' : '暂存'}</span>
        <button className="staged-btn" onClick={clearStaged} disabled={!staged.text}>
          清空
        </button>
        <button className="staged-btn is-primary" onClick={send} disabled={!staged.text.trim()}>
          发送
        </button>
      </div>
    </div>
  )
}
