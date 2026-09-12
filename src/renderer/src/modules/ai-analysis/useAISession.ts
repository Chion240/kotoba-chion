// ai-analysis · useAISession（CONTEXT.md「AI 分析会话」单一真值）。
// 薄 hook：状态住在模块级 session-store（收起面板/切章不销毁会话），此处只经 useSyncExternalStore 订阅直读。
// 视图直读 state，不镜像（CONTEXT 已标歧义教训：无 streamContent/streamStatus 镜像）。
import { useSyncExternalStore } from 'react'
import type { AiProfile } from '../../../../shared/contracts'
import type { SessionState } from './session-logic'
import { getSession, subscribe, sendMessage, cancelSession, resetSession } from './session-store'

export type UseAISession = {
  session: SessionState
  send: (userText: string, profile: AiProfile) => Promise<void>
  cancel: () => void
  reset: () => void
}

export function useAISession(): UseAISession {
  const session = useSyncExternalStore(subscribe, getSession)
  return { session, send: sendMessage, cancel: cancelSession, reset: resetSession }
}
