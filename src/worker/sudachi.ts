// tokenizer 会话（第 2 批）：Sudachi 分词纯核心。
// 无 DOM/Worker 依赖 —— worker shell 与独立自测共用此文件（铁律 4 能独立跑）。
//
// 引擎：sudachi-wasm333（sudachi.rs 的 WASM 版）。import 时其内联 base64 WASM
// 自 initSync，故 Node 与 Worker 皆可直接用。词典是独立 .dic 字节，由调用方注入
// （worker 用 fetch，自测用 fs.readFile），本核心只认 Uint8Array。
//
// 词典须用「官方 SudachiDict」（system_core.dic 等）。sudachi-wasm333 自带的
// resources/system.dic 是残缺词典（无 C-unit 切分数据、误分词），务必别用它。
import { SudachiStateless, TokenizeMode } from 'sudachi-wasm333'
import type { Token } from './contract'

// 契约 2 的 'A'|'B'|'C' → Sudachi 的 SplitMode 枚举。
// A=短单位（最细）、B=中单位、C=长单位（命名实体/复合词整体）。
const MODE_MAP: Record<'A' | 'B' | 'C', TokenizeMode> = {
  A: TokenizeMode.A,
  B: TokenizeMode.B,
  C: TokenizeMode.C
}

// Sudachi 形态素（sudachi-wasm333 的 TokenMorpheme 子集，只取契约用得到的字段）。
type Morpheme = {
  surface: string
  dictionary_form: string
  reading_form: string
  poses: string[]
}

export type SudachiTokenizer = {
  tokenize: (text: string, mode: 'A' | 'B' | 'C') => Token[]
}

// 形态素 → 契约 Token。字段名严守契约 2（禁改）。
// dictionaryForm（原形）为空/异常时兜底表层形 —— 点词写剪贴板的兜底（总纲第 5 节）。
function toToken(m: Morpheme): Token {
  const surface = m.surface
  return {
    surface,
    dictionaryForm: m.dictionary_form || surface,
    reading: m.reading_form || '',
    // Sudachi 品词是 6 段层级数组；契约 pos 是单串，逗号连接保全信息，去掉尾部占位 '*'。
    pos: m.poses.filter((p) => p && p !== '*').join(',')
  }
}

// 用官方词典字节建一个 tokenizer。词典一次加载常驻内存，之后 A/B/C 每次调用传入，
// 切模式零成本、无需重载（正合视口即时重算）。initialize_from_bytes 是同步的。
export function createTokenizer(dictBytes: Uint8Array): SudachiTokenizer {
  const s = new SudachiStateless()
  s.initialize_from_bytes(dictBytes)
  return {
    tokenize(text, mode) {
      if (!text) return []
      const morphemes = s.tokenize_raw(text, MODE_MAP[mode]) as unknown as Morpheme[]
      return morphemes.map(toToken)
    }
  }
}
