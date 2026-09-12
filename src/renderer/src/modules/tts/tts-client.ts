// tts · 合成客户端（渲染层直连本地 SoVITS localhost:9880，不经 IPC；同 ai-client 直连模式）。
// synthesize 入口第一行调 normalizeForTts —— 词/句/段/连续所有路径都经这里，清理单点根治。
// engine 分派：sovits POST /tts（Phase 0 已实测契约）；openai POST /audio/speech（Phase 3 挂点）。
// 纯请求组装 + fetch，可自测（body 形状断言）。
import type { VoiceProfile } from '../../../../shared/contracts'
import { normalizeForTts } from './tts-text'

// SoVITS POST /tts 请求体（TTS_HANDOFF 二节实测契约：text/text_lang/ref_audio_path/prompt_lang required）。
export function buildSovitsBody(profile: VoiceProfile, text: string): Record<string, unknown> {
  return {
    text,
    text_lang: profile.textLang || 'ja',
    ref_audio_path: profile.refAudioPath || '',
    prompt_text: profile.promptText || '',
    prompt_lang: profile.promptLang || 'ja',
    text_split_method: 'cut5',
    batch_size: 1,
    speed_factor: profile.speedFactor ?? 1.0,
    streaming_mode: false,
    media_type: 'wav'
  }
}

// OpenAI 兼容 POST /audio/speech 请求体（Phase 3）。
export function buildOpenAiBody(profile: VoiceProfile, text: string): Record<string, unknown> {
  return {
    model: profile.model || 'tts-1',
    voice: profile.voice || 'alloy',
    input: text,
    response_format: 'wav'
  }
}

// 渲染层组装请求 URL + headers + body（engine 分派），实际 fetch 由主进程代发。
// 渲染层直连 localhost:9880 会触发 CORS 预检，SoVITS api_v2 不实现 OPTIONS → 405 被拦；
// 故合成走主进程 Node fetch（无 CORS 限制）。文本规整仍在渲染层入口（单点根治）。
export function buildRequest(
  profile: VoiceProfile,
  text: string
): { url: string; headers: Record<string, string>; body: unknown } {
  const base = profile.baseURL.replace(/\/+$/, '')
  if (profile.engine === 'openai') {
    return {
      url: `${base}/audio/speech`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${profile.apiKey || ''}`
      },
      body: buildOpenAiBody(profile, text)
    }
  }
  return {
    url: `${base}/tts`,
    headers: { 'Content-Type': 'application/json' },
    body: buildSovitsBody(profile, text)
  }
}

let reqSeq = 0

// 合成一段朗读文本 → wav 字节。规整在入口第一行（单点根治）。规整后空串 → 抛（调用方不该发空）。
// 实际 fetch 走主进程（window.chion.ttsSynthesize）绕 CORS；signal 用于抢占（合成较慢，取消在途）。
// signal 必须真传到主进程：只在结果回来后判断 aborted 的话，SoVITS 仍会把废稿合成完，
// 跳转/停止后的新段要在串行队列里排它后面（跳一次要等十几秒）。
export async function synthesize(
  profile: VoiceProfile,
  rawText: string,
  signal?: AbortSignal
): Promise<ArrayBuffer> {
  const text = normalizeForTts(rawText)
  if (!text) throw new Error('规整后文本为空，无可朗读内容')
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
  const req = buildRequest(profile, text)
  const reqId = `tts-${++reqSeq}-${Date.now().toString(36)}`
  const onAbort = (): void => {
    void window.chion.ttsCancel(reqId)
  }
  signal?.addEventListener('abort', onAbort, { once: true })
  let bytes: Uint8Array
  try {
    bytes = await window.chion.ttsSynthesize(req, reqId)
  } finally {
    signal?.removeEventListener('abort', onAbort)
  }
  if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
  // Uint8Array → ArrayBuffer（切片保证不含 IPC 传输的额外 buffer 尾巴）。
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}
