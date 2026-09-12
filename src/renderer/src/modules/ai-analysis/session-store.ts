// ai-analysis · AI 分析会话的模块级 store（CONTEXT.md「AI 分析会话」单一真值）。
// 状态挂在模块作用域（仿 interaction/staged-store.ts、settings-store.ts），不随任何组件挂载而生灭
// —— 收起右面板 / 切章时 AIPanel 卸载，会话仍在（CONTEXT 铁律：面板只是会话的视图，收起不销毁）。
// 视图经 useAISession 直读，不镜像（CONTEXT 已标歧义教训：无 streamContent/streamStatus 镜像）。
import type { AiProfile } from '../../../../shared/contracts'
import { streamChat, type ChatMessage } from './ai-client'
import { sessionReducer, initialSession, type SessionState, type SessionAction } from './session-logic'

let state: SessionState = initialSession
let abort: AbortController | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

// 派发 → 纯 reducer 算新态 → 通知订阅者。
function dispatch(action: SessionAction): void {
  state = sessionReducer(state, action)
  emit()
}

export function getSession(): SessionState {
  return state
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// 发一轮：组装 [system?, 历史 messages, user] → 流式 → 到 done 写按逻辑日存档。
// 历史直接读模块级 state.messages（不再需要 ref 绕闭包——store 无闭包陈旧问题）。
export async function sendMessage(userText: string, profile: AiProfile): Promise<void> {
  const outbound: ChatMessage[] = [
    ...(profile.systemPrompt ? [{ role: 'system' as const, content: profile.systemPrompt }] : []),
    ...state.messages,
    { role: 'user', content: userText }
  ]
  dispatch({ type: 'startRound', userText })

  const ac = new AbortController()
  abort = ac
  let assistantText = ''
  try {
    await streamChat(profile, outbound, {
      signal: ac.signal,
      onDelta: (delta) => {
        assistantText += delta
        dispatch({ type: 'appendDelta', delta })
      }
    })
    dispatch({ type: 'finish' })
    // 到 done 才写存档（CONTEXT 铁律：不回灌实时框，开机实时框永远为空）。
    if (assistantText) {
      void window.chion.appendChatArchive({ userText, assistantText, ts: Date.now() })
    }
  } catch (e) {
    // 用户主动取消（abort）：保留已收部分，落 done，并把这轮也存档。
    if (ac.signal.aborted) {
      dispatch({ type: 'cancel' })
      if (assistantText) {
        void window.chion.appendChatArchive({ userText, assistantText, ts: Date.now() })
      }
    } else {
      dispatch({ type: 'fail', error: e instanceof Error ? e.message : String(e) })
    }
  } finally {
    abort = null
  }
}

export function cancelSession(): void {
  abort?.abort()
}

export function resetSession(): void {
  abort?.abort()
  dispatch({ type: 'reset' })
}
