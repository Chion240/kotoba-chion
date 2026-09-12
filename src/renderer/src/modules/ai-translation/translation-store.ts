// ai-translation · 译文 store（模块级单一真值，仿 session-store/staged-store）。
// 译文是单句、一次性（CONTEXT）：Map<segId, entry>；流式 delta 写 entry.text，收完落库复用。
import { useSyncExternalStore } from 'react'
import { translateSegment } from './translate'
import { getTranslationConfig } from './translation-config'

export type TranslationEntry = {
  status: 'loading' | 'done' | 'error'
  text: string
  error?: string
}

let entries = new Map<number, TranslationEntry>()
const aborts = new Map<number, AbortController>()
const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

// 不可变替换（useSyncExternalStore 靠引用变化触发；未变的 entry 引用不动，避免无谓重渲）。
function setEntry(segId: number, entry: TranslationEntry): void {
  entries = new Map(entries)
  entries.set(segId, entry)
  emit()
}

export function getTranslation(segId: number): TranslationEntry | undefined {
  return entries.get(segId)
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// 发起一段翻译（纯日语书按 t 触发；安全门在 reader 层用 shouldTranslate 把守）。
// 连接 + 提示词读独立翻译配置（getTranslationConfig，设置「翻译」分区自定义）。
// 去重：该 segId 已 loading/done 则直接返回（防按两次 t 重发/重复请求）。error 态允许重试（重新发起）。
// apiKey 空 → 置 error（未配置翻译 API），不发请求。
export async function translate(segId: number, jpText: string): Promise<void> {
  const cur = entries.get(segId)
  if (cur && cur.status !== 'error') return // loading/done 去重
  const config = getTranslationConfig()
  if (!config.apiKey.trim()) {
    setEntry(segId, {
      status: 'error',
      text: '',
      error: '未配置翻译 API（设置→翻译，填 apiKey）'
    })
    return
  }

  const ac = new AbortController()
  aborts.set(segId, ac)
  setEntry(segId, { status: 'loading', text: '' })
  try {
    const translated = await translateSegment(config, jpText, {
      signal: ac.signal,
      onDelta: (delta) => {
        const e = entries.get(segId)
        setEntry(segId, { status: 'loading', text: (e?.text ?? '') + delta })
      }
    })
    setEntry(segId, { status: 'done', text: translated })
    // 收完落库复用（zh_source='ai'）——下次按 t 直接读库不再请求（reader 优先读 seg.zh_text）。
    void window.chion.saveAiTranslation(segId, translated)
  } catch (e) {
    setEntry(segId, {
      status: 'error',
      text: '',
      error: e instanceof Error ? e.message : String(e)
    })
  } finally {
    aborts.delete(segId)
  }
}

// 取消口（YAGNI：段滚出视口不强制取消，翻译短、让它跑完落库更划算；留口供未来用）。
export function cancel(segId: number): void {
  aborts.get(segId)?.abort()
}

// 订阅单段译文（视图直读，无镜像）。未变的段返回同一 entry 引用 → 不触发该段重渲。
export function useTranslation(segId: number): TranslationEntry | undefined {
  return useSyncExternalStore(
    subscribe,
    () => entries.get(segId),
    () => entries.get(segId)
  )
}
