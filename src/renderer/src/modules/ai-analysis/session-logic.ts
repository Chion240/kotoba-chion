// ai-analysis · AI 分析会话的纯状态机（CONTEXT.md「AI 分析会话」单一真值）。
// 无 React/electron 依赖 —— test:ai 直测状态迁移 + messages 累积（铁律 4）。
// messages 是 [user, assistant]… 累积数组；流式内容写入最后一条 assistant。
import type { ChatMessage } from './ai-client'

export type SessionStatus = 'idle' | 'streaming' | 'done' | 'error'

export type SessionState = {
  status: SessionStatus
  messages: ChatMessage[] // 多轮累积；所有档案共用同一 messages（CONTEXT）
  error: string | null
}

export const initialSession: SessionState = { status: 'idle', messages: [], error: null }

export type SessionAction =
  | { type: 'startRound'; userText: string } // 推 [user, 空 assistant]，进 streaming
  | { type: 'appendDelta'; delta: string } // 写最后一条 assistant
  | { type: 'finish' } // 到达终态 done（此后调用方写存档）
  | { type: 'fail'; error: string } // 流式失败
  | { type: 'cancel' } // 用户取消：保留已收部分，落 done（可再发下一轮）
  | { type: 'reset' } // 清空会话

// 把 delta 追加到最后一条 assistant（不可变）。
function appendToLastAssistant(messages: ChatMessage[], delta: string): ChatMessage[] {
  const last = messages[messages.length - 1]
  if (!last || last.role !== 'assistant') return messages
  return messages.map((m, i) =>
    i === messages.length - 1 ? { ...m, content: m.content + delta } : m
  )
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'startRound':
      return {
        status: 'streaming',
        error: null,
        messages: [
          ...state.messages,
          { role: 'user', content: action.userText },
          { role: 'assistant', content: '' }
        ]
      }
    case 'appendDelta':
      return { ...state, messages: appendToLastAssistant(state.messages, action.delta) }
    case 'finish':
      return { ...state, status: 'done' }
    case 'fail':
      return { ...state, status: 'error', error: action.error }
    case 'cancel':
      return { ...state, status: 'done' }
    case 'reset':
      return initialSession
    default:
      return state
  }
}
