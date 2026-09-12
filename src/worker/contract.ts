// 契约 2：分词（reader-view ↔ tokenizer Worker）
// 见 V3_MASTER_PLAN.md 第 4 节。本文件是跨层共享的类型真值，勿在别处重复定义。

export type TokenizeReq = { seq: number; text: string; mode: 'A' | 'B' | 'C' }

export type Token = {
  surface: string
  dictionaryForm: string
  reading: string
  pos: string
}

export type TokenizeRes = { seq: number; tokens: Token[] }
