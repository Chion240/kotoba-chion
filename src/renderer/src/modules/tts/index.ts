// tts 模块公开面（renderer 侧，后挂）。职责：声音档案多档案 + 单单元点击即播（词/句/段）。
// 概念见 CONTEXT.md「声音档案 / 朗读单元 / 播放会话」；契约 CR-5。合成走渲染层直连 localhost:9880。
export { PlaybackBar } from './PlaybackBar'
export { VoiceTab } from './VoiceTab'
export { useVoiceProfiles } from './useVoiceProfiles'
export { useContinuousReading } from './useContinuousReading'
export {
  usePlayback,
  playSingle,
  playUrl,
  synthesizeToUrl,
  stop,
  stopReading,
  setEnabled,
  setReading,
  setCurrentSeq,
  getPlayback,
  type PlaybackState
} from './playback-store'
export { normalizeForTts } from './tts-text'
export { synthesize } from './tts-client'
