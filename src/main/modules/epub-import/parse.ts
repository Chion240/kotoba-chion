// epub-import · XHTML → 段落解析 + 双语配对（总纲第 3 节，最高优先级）。
// 纯字符串/正则，calibre 产出的 XHTML 良构且窄稳（总纲第 3 节末：据「一段日一段中」窄而稳）。
// ponytail: 不引 HTML parser；结构靠 opacity/假名判定，遇未知一律降级为日文正文段，绝不隐藏日文。

export type Ruby = { base: string; rt: string }

// 解析产物：一个待入库段（未定 seq/id/chapter，由 import 编排层分配）。
export type ParsedSeg = {
  type: 'pair' | 'heading' | 'image'
  jp_text: string
  zh_text: string
  ruby: Ruby[]
  image_ref: string | null // 相对 zip 内路径（已归一到 opf 根）；非 image 为 null
}

// 假名（平/片/半角片）→ 判日文的唯一依据（总纲第 3 节：绝不用假名比例猜）。
const KANA = /[\u3040-\u309f\u30a0-\u30ff\uff66-\uff9f]/

export function hasKana(s: string): boolean {
  return KANA.test(s)
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': '\u00a0'
}

// 码点越界（如 &#99999999; 这类脏 EPUB）会让 String.fromCodePoint 抛 RangeError，
// 整本导入随之失败。非法值保留原文，绝不因一个坏实体丢掉整章。
function codePoint(raw: string, n: number): string {
  return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : raw
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (m, n) => codePoint(m, Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (m, n) => codePoint(m, parseInt(n, 16)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m] ?? m)
}

// CJK 字符（假名/汉字/半角片假名/CJK 标点/全角形）—— 判「夹在字之间的空白该不该清」。
const CJK = '\\u3040-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uff00-\\uffef\\u3000-\\u303f'
// 夹在两个 CJK 字之间的空白（含缩进空格/全角空格）→ 清除。lookahead 不吃掉右字，
// 使相邻多处（如「魔 法」紧接「色 の」）能连续命中（骨色の 魔 法 → 骨色の魔法）。
const CJK_GAP = new RegExp(`([${CJK}])[ \\u3000]+(?=[${CJK}])`, 'g')

// 剥标签取纯文本：先删 <rt>（注音不进正文），再删残余标签，解实体，收拢空白。
// 拉丁词间单空格保留（如 "Paradise Coldplay"）；缩进/换行归一为单空格后，
// 再清除夹在 CJK 汉字/假名之间的空白（calibre 把作者注音标签缩进换行，删标签后残留空格 → 骨色の 魔 法）。
export function plainText(html: string): string {
  const noRt = html.replace(/<rt\b[^>]*>[\s\S]*?<\/rt>/gi, '')
  const noTags = noRt.replace(/<[^>]+>/g, '')
  return decodeEntities(noTags)
    .replace(/[\t\r\n]+/g, ' ') // 换行/缩进先归一为单空格（勿直接删，防拉丁词粘连）
    .replace(/[ \u3000]{2,}/g, ' ')
    .replace(CJK_GAP, '$1') // 夹在 CJK 字之间的空白清除（lookahead 不吃右字 → 相邻对连续命中）
    .replace(/^[\s\u3000]+|[\s\u3000]+$/g, '')
}

// 从一段 html 抽 ruby：每个 <ruby> 内按位置配对 <rb>/<rt>；
// 无 <rb> 时以「去掉 rt 后的文本」为 base（兜底，绝不丢字）。
function extractRuby(html: string): Ruby[] {
  const out: Ruby[] = []
  const rubyRe = /<ruby\b[^>]*>([\s\S]*?)<\/ruby>/gi
  let m: RegExpExecArray | null
  while ((m = rubyRe.exec(html))) {
    const inner = m[1]
    const rbs = [...inner.matchAll(/<rb\b[^>]*>([\s\S]*?)<\/rb>/gi)].map((x) =>
      plainText(x[1])
    )
    const rts = [...inner.matchAll(/<rt\b[^>]*>([\s\S]*?)<\/rt>/gi)].map((x) =>
      plainText(x[1])
    )
    if (rbs.length) {
      rbs.forEach((base, i) => {
        if (base) out.push({ base, rt: rts[i] ?? '' })
      })
    } else {
      const base = plainText(inner.replace(/<rt\b[^>]*>[\s\S]*?<\/rt>/gi, ''))
      if (base) out.push({ base, rt: rts.join('') })
    }
  }
  return out
}

// style 里的 opacity（无则返回 1）。
function opacityOf(attrs: string): number {
  const m = /opacity\s*:\s*([\d.]+)/i.exec(attrs)
  return m ? Number(m[1]) : 1
}

type Block = {
  isImage: boolean
  imgSrc: string | null
  isEmpty: boolean // 只有 <br>/空白，无文本无图（总纲第 3 节：空段丢弃）
  isJp: boolean // opacity<1 或含假名（总纲第 3 节判定①②）
  isHeading: boolean // <hN> 或标题类 class（best-effort）
  text: string
  ruby: Ruby[]
}

// EPUB 固定版式常用 SVG <image xlink:href="...">，流式正文则多用 <img src="...">。
// 两者统一抽成图片段，避免只显示封面而漏掉正文插图。
function imageSource(attrs: string): string | null {
  return (
    /\b(?:src|href|xlink:href)\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] ?? null
  )
}

function imageSourceInMarkup(markup: string): string | null {
  const match = /<(?:img|image)\b([^>]*)\/?\s*>/i.exec(markup)
  return match ? imageSource(match[1]) : null
}

const HEADING_CLASS = /(^|\s)(font-1em2|[a-z-]*head[a-z-]*|[a-z-]*title[a-z-]*|chapter)/i

// 抽 body 内 <p>/<hN> 为线性 block 列表，保文档流顺序（总纲问题 8：按流分配 seq）。
// ponytail: 同名标签不嵌套（calibre 产出如此）；真遇嵌套 <p> 再上正经 parser。
function extractBlocks(html: string, resolveImg: (src: string) => string): Block[] {
  const body = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html)?.[1] ?? html
  // 同时消费段落块和 body 中独立的 SVG image；段落内的 image 会由段落分支一次性处理，不重复。
  const re = /<(p|h[1-6])\b([^>]*)>([\s\S]*?)<\/\1>|<(img|image)\b([^>]*)\/?\s*>/gi
  const blocks: Block[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    const standaloneAttrs = m[5]
    const tag = m[1] ?? m[4] ?? 'p'
    const attrs = m[2] ?? ''
    const inner = m[3] ?? ''
    const imgSrc = standaloneAttrs ? imageSource(standaloneAttrs) : imageSourceInMarkup(inner)
    const text = plainText(inner)
    const cls = /class\s*=\s*["']([^"']*)["']/i.exec(attrs)?.[1] ?? ''
    const isHeading = /^h[1-6]$/i.test(tag) || HEADING_CLASS.test(cls)
    blocks.push({
      isImage: !!imgSrc,
      imgSrc: imgSrc ? resolveImg(imgSrc) : null,
      isEmpty: !imgSrc && text === '',
      isJp: opacityOf(attrs) < 1 || hasKana(text),
      isHeading,
      text,
      ruby: extractRuby(inner)
    })
  }
  return blocks
}

// 双语路径：日文段 + 其后第一个非空段配对；空段丢弃；图片独立；
// 遇无法识别（孤立非日文段）→ 降级为日文正文段（绝不隐藏日文，总纲第 3 节）。
function pairBilingual(blocks: Block[]): ParsedSeg[] {
  const out: ParsedSeg[] = []
  const type = (b: Block): 'pair' | 'heading' => (b.isHeading ? 'heading' : 'pair')
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (b.isEmpty) continue
    if (b.isImage) {
      out.push({ type: 'image', jp_text: '', zh_text: '', ruby: [], image_ref: b.imgSrc })
      continue
    }
    if (b.isJp) {
      // 找其后第一个非空段作译文；若该段也是日文 → 不吞，本段作无译文 pair。
      let j = i + 1
      while (j < blocks.length && blocks[j].isEmpty) j++
      const next = blocks[j]
      if (next && !next.isImage && !next.isJp) {
        out.push({ type: type(b), jp_text: b.text, zh_text: next.text, ruby: b.ruby, image_ref: null })
        i = j // 消费掉译文段
      } else {
        out.push({ type: type(b), jp_text: b.text, zh_text: '', ruby: b.ruby, image_ref: null })
      }
      continue
    }
    // 孤立非日文段（无前置日文）：降级为日文正文段显示，绝不隐藏。
    out.push({ type: type(b), jp_text: b.text, zh_text: '', ruby: b.ruby, image_ref: null })
  }
  return out
}

// 纯日语路径（决策 6：两条独立解析路径）：不配对，每个非空文本段即一段日文。
function parseJpOnly(blocks: Block[]): ParsedSeg[] {
  const out: ParsedSeg[] = []
  for (const b of blocks) {
    if (b.isEmpty) continue
    if (b.isImage) {
      out.push({ type: 'image', jp_text: '', zh_text: '', ruby: [], image_ref: b.imgSrc })
    } else {
      out.push({
        type: b.isHeading ? 'heading' : 'pair',
        jp_text: b.text,
        zh_text: '',
        ruby: b.ruby,
        image_ref: null
      })
    }
  }
  return out
}

// 单文档解析入口。mode 决定走哪条路径（决策 6）。resolveImg 把 <img src> 归一到 zip 内路径。
export function parseDoc(
  html: string,
  mode: 'bilingual' | 'jp',
  resolveImg: (src: string) => string
): ParsedSeg[] {
  const blocks = extractBlocks(html, resolveImg)
  return mode === 'bilingual' ? pairBilingual(blocks) : parseJpOnly(blocks)
}
