// ai-analysis 模块公开面（renderer 侧，后挂）。职责：选中→流式 AI 分析会话 + 多档案 + 按逻辑日存档。
// 概念见 CONTEXT.md「AI 分析会话 / AI 档案 / 对话存档 / 逻辑日」；契约 CR-3。
export { AIPanel } from './AIPanel'
// useAISession 是薄订阅；会话状态住模块级 session-store（收起面板/切章不销毁，CONTEXT 铁律，会话 13）。
export { useAISession } from './useAISession'
export { useAiProfiles } from './useAiProfiles'
// ai-translation 会话复用：streamChat/parseSSE（连接与 SSE 解析），配 AI 档案连接 + 独立翻译提示词。
export { streamChat, parseSSE, type ChatMessage } from './ai-client'
