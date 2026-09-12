/** Data contracts crossing the Electron process boundary. */
export type Ruby = { base: string; rt: string }

export type Segment = {
  id: number
  book_id: number
  chapter_id: number
  seq: number
  type: 'pair' | 'heading' | 'image'
  jp_text: string
  zh_text: string
  zh_source: 'builtin' | 'ai' | null
  ruby: Ruby[]
  image_ref: string | null
}

export type SegmentInput = Omit<Segment, 'id'>

export type BookMeta = {
  id: number
  title: string
  kind: 'bilingual' | 'jp'
  created_at: number
  cover_ref: string | null
}

export type ChapterMeta = {
  id: number
  ordinal: number
  title: string
  startSeq: number
  endSeq: number
}

export type Progress = { seq: number; updated_at: number }

export type ImportResult = {
  bookId: number
  chapters: number
  segments: number
  coverRef: string | null
}

export type AiProfile = {
  id: string
  name: string
  baseURL: string
  apiKey: string
  model: string
  systemPrompt: string
  temperature?: number
}
export type AiProfilesState = { profiles: AiProfile[]; activeId: string }
export type ChatRound = { userText: string; assistantText: string; ts: number }
export type ChatArchiveDay = { day: string; rounds: ChatRound[] }

export type FontMeta = {
  id: string
  family: string
  fileName: string
  path: string
}

export type VoiceProfile = {
  id: string
  name: string
  engine: 'sovits' | 'openai'
  baseURL: string
  refAudioPath?: string
  promptText?: string
  promptLang?: string
  textLang?: string
  speedFactor?: number
  apiKey?: string
  model?: string
  voice?: string
}
export type VoiceProfilesState = { profiles: VoiceProfile[]; activeId: string }
export type TtsSynthesizeReq = { url: string; headers: Record<string, string>; body: unknown }

export type IntegrationSettings = {
  autoLaunchDictionaryApp: boolean
  dictionaryAppPath: string
}
