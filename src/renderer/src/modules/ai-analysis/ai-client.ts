// ai-analysis · AI 客户端（渲染层直连 DeepSeek，OpenAI 兼容 SSE，不经 IPC）。
// SSE 解析抽为纯函数（test:ai 直测）；streamChat 用 fetch + AbortController 取消。
import type { AiProfile } from '../../../../shared/contracts'

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

// SSE 解析纯函数：喂入「上次残余 buffer + 新 chunk」，切出完整行的 delta 文本。
// OpenAI 兼容：每行 `data: {json}`，最后 `data: [DONE]`。跨 chunk 的半行留在 buffer 下次拼回。
// 只取 choices[0].delta.content；错误由 streamChat 的 HTTP 层判（res.ok），此处保持纯净。
export function parseSSE(
  buffer: string,
  chunk: string
): { deltas: string[]; done: boolean; buffer: string } {
  const text = buffer + chunk
  const lines = text.split('\n')
  // 最后一段可能是半行（无换行结尾）——留回 buffer。
  const rest = lines.pop() ?? ''
  const deltas: string[] = []
  let done = false
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || !line.startsWith('data:')) continue
    const payload = line.slice(5).trim()
    if (payload === '[DONE]') {
      done = true
      continue
    }
    try {
      const json = JSON.parse(payload)
      const delta = json?.choices?.[0]?.delta?.content
      if (typeof delta === 'string' && delta.length > 0) deltas.push(delta)
    } catch {
      // 半个 JSON 落到完整行不该发生；容错跳过（下一 chunk 不会重发同行）。
    }
  }
  return { deltas, done, buffer: rest }
}

export type StreamHandlers = {
  onDelta: (delta: string) => void
  signal?: AbortSignal
}

// 流式一轮：POST /chat/completions（stream:true），逐 chunk 喂 parseSSE，delta 回调上抛。
// baseURL 末尾斜杠归一；apiKey 走 Bearer。非 2xx / 网络错 → throw（useAISession 落 error 态）。
export async function streamChat(
  profile: AiProfile,
  messages: ChatMessage[],
  { onDelta, signal }: StreamHandlers
): Promise<void> {
  const base = profile.baseURL.replace(/\/+$/, '')
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${profile.apiKey}`
    },
    body: JSON.stringify({
      model: profile.model,
      messages,
      stream: true,
      ...(profile.temperature != null ? { temperature: profile.temperature } : {})
    }),
    signal
  })

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '')
    throw new Error(`AI 请求失败 (${res.status})${detail ? ': ' + detail.slice(0, 200) : ''}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    const parsed = parseSSE(buffer, decoder.decode(value, { stream: true }))
    buffer = parsed.buffer
    for (const d of parsed.deltas) onDelta(d)
    if (parsed.done) break
  }
}
