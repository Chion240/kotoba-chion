// ai-translation · 纯逻辑（无 React/DOM/网络，test:ai-translation 直测，铁律 4）。
// 译文 ≠ AI 分析会话（CONTEXT）：单句、一次性、不进聊天框、不多轮。独立翻译配置（连接 + 提示词都与 AI 分析档案分开）。
import type { Segment } from '../../../../shared/contracts'
import type { ChatMessage } from '../ai-analysis'

// 默认翻译提示词（用户可在设置「翻译」分区改）。目标：只回一句干净中文。
export const TRANSLATE_SYSTEM_PROMPT =
  '你是日译中翻译。把用户发来的日文原样翻成自然流畅的简体中文。只输出译文本身：不要解释、不要注音、不要重复原文、不要引号或前后缀。'

// 翻译配置（完全独立于 AI 分析档案，存 localStorage）：连接 + 提示词五件套，用户在设置面板自定义。
export type TranslationConfig = {
  baseURL: string
  apiKey: string
  model: string
  systemPrompt: string // 翻译提示词（非 AI 分析的 systemPrompt）
  temperature?: number
}

// 默认配置（DeepSeek 兼容，apiKey 留空由用户填；提示词默认现常量）。
export const DEFAULT_TRANSLATION_CONFIG: TranslationConfig = {
  baseURL: 'https://api.deepseek.com',
  apiKey: '',
  model: 'deepseek-chat',
  systemPrompt: TRANSLATE_SYSTEM_PROMPT,
  temperature: 1.0
}

// 脏 JSON / 缺字段 → 合法 config（向前兼容 + 兜底默认）。空/非字符串提示词回落默认常量。
export function coerceTranslationConfig(raw: unknown): TranslationConfig {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const str = (v: unknown, d: string): string => (typeof v === 'string' ? v : d)
  const t = Number(o.temperature)
  return {
    baseURL: str(o.baseURL, DEFAULT_TRANSLATION_CONFIG.baseURL),
    apiKey: str(o.apiKey, DEFAULT_TRANSLATION_CONFIG.apiKey),
    model: str(o.model, DEFAULT_TRANSLATION_CONFIG.model),
    systemPrompt: str(o.systemPrompt, TRANSLATE_SYSTEM_PROMPT) || TRANSLATE_SYSTEM_PROMPT,
    temperature: Number.isFinite(t) ? t : DEFAULT_TRANSLATION_CONFIG.temperature
  }
}

// 组翻译一轮的 messages = [system(翻译提示词), user(日文)]。提示词来自 config（默认现常量），非 AI 分析 systemPrompt。
export function buildTranslateMessages(
  jpText: string,
  systemPrompt: string = TRANSLATE_SYSTEM_PROMPT
): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt || TRANSLATE_SYSTEM_PROMPT },
    { role: 'user', content: jpText }
  ]
}

// 安全门（最重要，铁律 3）：书级 kind 门 + 段级判定。
// jp + 非 image + 无内置/已落库 zh_text → 可翻译；否则一律不翻。
// 双语书恒 false（zh_text 空也不翻——只走内置译文），防「双语某段缺内置译文误触 AI」。
export function shouldTranslate(kind: 'bilingual' | 'jp', seg: Segment): boolean {
  return kind === 'jp' && seg.type !== 'image' && !seg.zh_text
}
