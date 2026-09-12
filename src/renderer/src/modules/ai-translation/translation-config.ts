// ai-translation · 翻译配置 store（模块级单一真值，仿 settings-store）。
// 独立于 AI 分析档案：连接 + 提示词存 localStorage 单键 `chion-translation-config`，设置「翻译」分区是其视图。
import { useSyncExternalStore } from 'react'
import {
  coerceTranslationConfig,
  DEFAULT_TRANSLATION_CONFIG,
  type TranslationConfig
} from './translation-logic'

const KEY = 'chion-translation-config'

function read(): TranslationConfig {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? coerceTranslationConfig(JSON.parse(raw)) : { ...DEFAULT_TRANSLATION_CONFIG }
  } catch {
    return { ...DEFAULT_TRANSLATION_CONFIG }
  }
}

let state: TranslationConfig = read()
const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

export function getTranslationConfig(): TranslationConfig {
  return state
}

export function subscribeConfig(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// 改一项 → coerce 保证合法 → 写 localStorage → emit。
export function setTranslationConfig(patch: Partial<TranslationConfig>): void {
  state = coerceTranslationConfig({ ...state, ...patch })
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // 忽略配额/隐私模式写入失败——内存态仍生效。
  }
  emit()
}

export function useTranslationConfig(): TranslationConfig {
  return useSyncExternalStore(subscribeConfig, getTranslationConfig, getTranslationConfig)
}
