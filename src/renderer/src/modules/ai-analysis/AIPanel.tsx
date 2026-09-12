import { useEffect, useRef } from 'react'
import { StagedInputBox } from '../interaction'
import { useAISession } from './useAISession'
import { useAiProfiles } from './useAiProfiles'
import './ai-analysis.css'

// AIPanel（会话 12 搬家后）：只留档案标签切换 + 消息列表 + 输入区（复用 interaction StagedInputBox）。
// ⚙ 配置（增删档案 + 编辑连接/提示词）已搬进 settings 面板的「AI 档案」分区，底层仍走 useAiProfiles CRUD。
// 视图直读 session.messages（单一真值，无镜像）；StagedInputBox onSend 接 send。
export function AIPanel(): React.JSX.Element {
  const { session, send, cancel } = useAISession()
  const { state, activeProfile, setActive } = useAiProfiles()

  // 流式跟随滚动：新消息/流式追加时贴到底；但用户主动往上翻（离底 > 40px）就不打扰。
  const listRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)
  const onListScroll = (): void => {
    const el = listRef.current
    if (!el) return
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }
  useEffect(() => {
    const el = listRef.current
    if (el && stickToBottomRef.current) el.scrollTop = el.scrollHeight
  }, [session.messages])

  const onSend = (text: string): void => {
    if (activeProfile) void send(text, activeProfile)
  }

  return (
    <div className="ai-panel">
      <div className="ai-tabs">
        {state.profiles.map((p) => (
          <button
            key={p.id}
            className={p.id === state.activeId ? 'ai-tab is-active' : 'ai-tab'}
            onClick={() => setActive(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="ai-messages" ref={listRef} onScroll={onListScroll}>
        {session.messages.length === 0 ? (
          <div className="ai-empty">点词 / 选段 → 发送，开始 AI 分析。</div>
        ) : (
          session.messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'ai-msg is-user' : 'ai-msg is-assistant font-reading-jp'}>
              {m.content || (session.status === 'streaming' ? '…' : '')}
            </div>
          ))
        )}
      </div>

      {session.status === 'streaming' && (
        <div className="ai-status">
          <span>生成中…</span>
          <button className="ai-cancel-btn" onClick={cancel}>
            取消
          </button>
        </div>
      )}
      {session.status === 'error' && (
        <div className="ai-status is-error">{session.error}</div>
      )}

      <StagedInputBox onSend={onSend} />
    </div>
  )
}
