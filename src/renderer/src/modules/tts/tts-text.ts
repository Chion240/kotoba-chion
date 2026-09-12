// tts · 文本规整（TTS text normalization）。纯函数，无 DOM/网络/React。
// 送合成前把朗读文本清成朗读友好的纯文本——去掉 TTS 会读错的符号。
// **必须在 tts-client.synthesize() 入口第一行调用**：词/句/段/连续所有路径都经 synthesize，
// 清理只写这一处（单点根治），别在各调用方各清一遍。
//
// 跟 ai-translation 无关：那是译文提示词层；这是「要朗读的日文原文」的规整层，不是翻译。
//
// 规则（用户确认的默认实现）：
//   1. 去括号注释类符号，保留内容：『』「」（）()【】〔〕[]〈〉《》 只删符号，中身留着朗读
//   2. 全角英数/ASCII 符号 → 半角（日文标点 。！？、 保留，SoVITS 靠它断句韵律）
//   3. 去 emoji + 杂符号
//   4. 去 ruby 残留（<rt>…</rt> / <rp>…</rp> 标签）、URL、控制字符
//   5. 压缩连续空白为单个、去首尾空白

// 括号类：只删这些「符号本身」，括号内的文字保留（注释/旁白仍朗读，不误删）。
const BRACKETS = /[『』「」（）()【】〔〕［］\[\]〈〉《》｛｝{}]/g

// ruby 残留标签（分词/注音层若漏进原文）：连标签带内容一起删（rt=读音，重复朗读会怪）。
const RUBY_TAGS = /<(rt|rp)>[\s\S]*?<\/\1>|<\/?(ruby|rt|rp)>/gi

// URL（http/https）。
const URL_RE = /https?:\/\/[^\s　]+/gi

// 控制字符（保留 \n 供连续朗读断句；其余行分隔符先统一成 \n）。
const LINE_BREAKS = /\r\n?|\u2028|\u2029/g
const CONTROL = /[\u0000-\u0009\u000b-\u001f\u007f\u200b-\u200f\ufeff]/g

// emoji 与杂图形符号（常见区段：情感符号/交通/杂项/补充符号/旗帜/装饰符号等）。
const EMOJI =
  /[\u{1f000}-\u{1faff}\u{2600}-\u{27bf}\u{2b00}-\u{2bff}\u{fe00}-\u{fe0f}\u{1f1e6}-\u{1f1ff}\u2190-\u21ff\u2300-\u23ff]/gu

// 全角 ASCII（！-～，U+FF01–FF5E）→ 半角；全角空格 → 半角空格。
function toHalfWidth(s: string): string {
  return s
    .replace(/[\uff01-\uff5e]/g, (c) =>
      c === '！' || c === '？' ? c : String.fromCharCode(c.charCodeAt(0) - 0xfee0)
    )
    .replace(/\u3000/g, ' ')
}

export function normalizeForTts(text: string): string {
  if (!text) return ''
  let t = text
  t = t.replace(RUBY_TAGS, '')
  t = t.replace(URL_RE, '')
  t = t.replace(LINE_BREAKS, '\n')
  t = t.replace(CONTROL, '')
  t = t.replace(EMOJI, '')
  t = t.replace(BRACKETS, '')
  t = toHalfWidth(t)
  t = t.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim()
  return t
}

const SENTENCE_END = new Set(['。', '！', '？', '!', '?'])

// 连续朗读专用断句：先走统一规整，再按日文句末标点/换行切分。
// 连续标点属于同一句；逗号和英文句点保留在句内，避免小数或缩写误切。
export function splitTtsSentences(text: string): string[] {
  const normalized = normalizeForTts(text)
  if (!normalized) return []

  const chars = Array.from(normalized)
  const sentences: string[] = []
  let current = ''
  const flush = (): void => {
    const value = current.trim()
    if (value) sentences.push(value)
    current = ''
  }

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]
    if (char === '\n') {
      flush()
      continue
    }
    current += char
    if (SENTENCE_END.has(char) && !SENTENCE_END.has(chars[i + 1] ?? '')) flush()
  }
  flush()
  return sentences
}
