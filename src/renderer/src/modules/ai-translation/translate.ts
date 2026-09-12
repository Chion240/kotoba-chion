// ai-translation · 客户端封装（纯核心 + fetch，不落库、不碰 DOM，便于自测/复用）。
// 只借 ai-analysis 的 streamChat 连接 + SSE 能力（别复用 useAISession——译文非多轮，CONTEXT 铁律）。
// 连接 + 提示词来自独立的 TranslationConfig（与 AI 分析档案分开，用户在设置「翻译」分区自定义）。
import { streamChat } from '../ai-analysis'
import { buildTranslateMessages, type TranslationConfig } from './translation-logic'

export type TranslateHandlers = {
  onDelta?: (delta: string) => void
  signal?: AbortSignal
}

// 翻一段：组 [system(翻译提示词), user(日文)] → streamChat 流式 → 累积 delta 成整串返回。
// streamChat 收 AiProfile 形状；TranslationConfig 补占位 id/name 即可复用（只用 baseURL/apiKey/model/temperature）。
export async function translateSegment(
  config: TranslationConfig,
  jpText: string,
  { onDelta, signal }: TranslateHandlers = {}
): Promise<string> {
  let text = ''
  // streamChat 只用 baseURL/apiKey/model/temperature；补占位 id/name/systemPrompt 满足 AiProfile 形状。
  await streamChat(
    { id: 'translation', name: 'translation', ...config },
    buildTranslateMessages(jpText, config.systemPrompt),
    {
      signal,
      onDelta: (delta) => {
        text += delta
        onDelta?.(delta)
      }
    }
  )
  return text.trim()
}
