// ruby 注音助手。
// 分词到达后，每个含汉字的 token 用其读音（Sudachi 给的片假名）转平假名作振假名。
// 这样振假名覆盖全部汉字词、随分词模式一致；书自带的 seg.ruby 是作者精选注音，
// 作为「分词未到达」时的降级来源（见下 authoredRubyHtml）。
// ponytail: token 读音注音够用；若要严格复刻作者注音，可做 token↔seg.ruby 区间对齐（升级路径）。

const KATA_START = 0x30a1
const KATA_END = 0x30f6

// 片假名→平假名（振假名惯用平假名）。非假名字符原样保留。
export function kataToHira(s: string): string {
  let out = ''
  for (const ch of s) {
    const code = ch.codePointAt(0)!
    out += code >= KATA_START && code <= KATA_END ? String.fromCodePoint(code - 0x60) : ch
  }
  return out
}

const KANJI_RE = /[\u4e00-\u9fff\u3400-\u4dbf]/

export function hasKanji(s: string): boolean {
  return KANJI_RE.test(s)
}

// 该 token 是否需要振假名：含汉字，且读音（平假名化）与表层形不同。
export function furiganaFor(surface: string, reading: string): string | null {
  if (!hasKanji(surface)) return null
  const hira = kataToHira(reading)
  if (!hira || hira === surface) return null
  return hira
}
