// ai-translation 模块公开面（renderer 侧，后挂）。职责：纯日语书按 t 的 AI 译文，落库 zh_source='ai' 复用。
// 概念见 CONTEXT.md「译文」：译文 ≠ AI 分析会话（单句、一次性、不进聊天框、不多轮）。双语书永不走 AI（铁律 3）。
export {
  shouldTranslate,
  TRANSLATE_SYSTEM_PROMPT,
  buildTranslateMessages,
  coerceTranslationConfig,
  DEFAULT_TRANSLATION_CONFIG,
  type TranslationConfig
} from './translation-logic'
export { translateSegment } from './translate'
export {
  translate,
  cancel,
  getTranslation,
  useTranslation,
  type TranslationEntry
} from './translation-store'
export {
  getTranslationConfig,
  setTranslationConfig,
  useTranslationConfig
} from './translation-config'
export { TranslationTab } from './TranslationTab'
