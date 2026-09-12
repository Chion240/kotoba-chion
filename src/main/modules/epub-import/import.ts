// epub-import · 编排层：解压→读 opf→按 spine 解析→图片落盘→入库。实现契约 4 的 importBook。
// 只依赖 zip/parse（本模块）+ 注入的 storage db，不 import electron —— 便于独立自测（铁律 4）。
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, posix } from 'node:path'
import { openZip, type Zip } from './zip'
import { parseDoc, type ParsedSeg } from './parse'
import type { SegmentInput } from '../storage/db'
import type { ImportResult } from '../../../shared/contracts'
export type { ImportResult } from '../../../shared/contracts'

// storage 会话留的写入入口（台账会话 2 下游须知）。只取本模块要用的方法（结构化类型，不 import electron）。
export type ImportDeps = {
  db: {
    insertBook(title: string, kind: 'bilingual' | 'jp'): number
    updateBookCover?(bookId: number, coverRef: string): void
    insertChapter(bookId: number, seq: number, title?: string): number
    insertSegments(segs: SegmentInput[]): void
    // 导入中途失败时回滚整本（insertBook/insertSegments 各自已提交，不清会留半本鬼书）。
    deleteBook?(bookId: number): void
  }
  booksRoot: string // 图片落盘根目录（生产 = userData/books）
}

// 图片落盘目录规则（总纲第 8 节留给本会话定）：<booksRoot>/<bookId>/images/<basename>。
// image_ref 存相对 booksRoot 的 posix 路径 "<bookId>/images/<basename>"（getImagePath 反解）。
export function imageDir(booksRoot: string, bookId: number): string {
  return join(booksRoot, String(bookId), 'images')
}

// 从 META-INF/container.xml 找 opf 的路径。
function findOpfPath(zip: Zip): string {
  const xml = zip.readText('META-INF/container.xml')
  const m = /<rootfile\b[^>]*\bfull-path\s*=\s*["']([^"']+)["']/i.exec(xml)
  if (!m) throw new Error('EPUB 损坏：container.xml 无 rootfile')
  return m[1]
}

// manifest 的 href 是 URI：文件名含空格/中文时 calibre 写成 chapter%201.xhtml，
// 而 zip 内条目名是解码后的原名。不解码则 zip.readText 必抛 → 整本导入失败。
function decodeHref(href: string): string {
  try {
    return decodeURIComponent(href)
  } catch {
    return href // 非法转义序列（含裸 %）保持原样，交给 zip 查找兜底
  }
}

// 解析 opf：书名 + spine 顺序的文档 zip 内路径列表（相对 opf 所在目录解析）。
export function parseOpf(zip: Zip, opfPath: string): { title: string; docs: string[]; coverPath: string | null } {
  const opf = zip.readText(opfPath)
  const base = posix.dirname(opfPath) // opf 所在目录，href 相对它
  const title =
    /<dc:title\b[^>]*>([\s\S]*?)<\/dc:title>/i.exec(opf)?.[1]?.trim() || '未命名'

  // manifest: id → href / media type；spine 只收 xhtml/html 文档。
  const hrefById = new Map<string, string>()
  const manifestHrefById = new Map<string, string>()
  const mediaById = new Map<string, string>()
  const coverIds = new Set<string>()
  const coverHrefs = new Set<string>()
  const itemRe = /<item\b([^>]*)\/?>/gi
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(opf))) {
    const attrs = m[1]
    const id = /\bid\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]
    const media = /\bmedia-type\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] ?? ''
    const properties = /\bproperties\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] ?? ''
    if (id && href) {
      const decodedHref = decodeHref(href)
      manifestHrefById.set(id, decodedHref)
      mediaById.set(id, media)
      if (/xhtml|html/.test(media)) hrefById.set(id, decodedHref)
      if (/^image\//.test(media) && /\bcover-image\b/i.test(properties)) coverHrefs.add(decodedHref)
    }
  }

  const metaRe = /<meta\b([^>]*)\/?>/gi
  let meta: RegExpExecArray | null
  while ((meta = metaRe.exec(opf))) {
    const attrs = meta[1]
    const name = /\bname\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]
    const content = /\bcontent\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]
    if (name?.toLowerCase() === 'cover' && content) coverIds.add(content)
  }
  const coverItem = [...coverIds].find((id) => /^image\//.test(mediaById.get(id) ?? ''))
  const coverHref = coverHrefs.values().next().value as string | undefined
  const coverPath = coverHref ?? (coverItem ? manifestHrefById.get(coverItem) ?? null : null)

  // spine: itemref 顺序 → 文档 zip 内路径
  const docs: string[] = []
  const refRe = /<itemref\b[^>]*\bidref\s*=\s*["']([^"']+)["']/gi
  while ((m = refRe.exec(opf))) {
    const href = hrefById.get(m[1])
    if (href) docs.push(base === '.' ? href : posix.join(base, href))
  }
  return { title, docs, coverPath: coverPath ? (base === '.' ? coverPath : posix.join(base, coverPath)) : null }
}

// importBook（契约 4）：path = epub 文件，mode = 用户手选（决策 6：两条独立解析路径）。
export function importBook(
  path: string,
  mode: 'bilingual' | 'jp',
  deps: ImportDeps
): ImportResult {
  const zip = openZip(readFileSync(path))
  const opfPath = findOpfPath(zip)
  const { title, docs, coverPath } = parseOpf(zip, opfPath)
  const opfBase = posix.dirname(opfPath)

  const bookId = deps.db.insertBook(title, mode)
  const imgOut = imageDir(deps.booksRoot, bookId)
  const imgNames = new Map<string, string>() // zip 内路径 → 已落盘文件名，避免重复写

  try {
    let seq = 0
    let segTotal = 0
    let coverRef: string | null = null
    if (coverPath && zip.has(coverPath)) {
      const coverName = uniqueImageName(posix.basename(coverPath), coverPath, new Set(imgNames.values()))
      mkdirSync(imgOut, { recursive: true })
      writeFileSync(join(imgOut, coverName), zip.read(coverPath))
      imgNames.set(coverPath, coverName)
      coverRef = posix.join(String(bookId), 'images', coverName)
      deps.db.updateBookCover?.(bookId, coverRef)
    }
    docs.forEach((docPath, chapIdx) => {
      const html = zip.readText(docPath)
      const docDir = posix.dirname(docPath)
      // <img src> 相对文档目录解析为 zip 内路径，归一（去 ./ ../）。
      const resolveImg = (src: string): string =>
        posix.normalize(docDir === '.' ? decodeHref(src) : posix.join(docDir, decodeHref(src)))
      const parsed = parseDoc(html, mode, resolveImg)

      // 章标题：本章首个 heading 段的日文；无则空。
      const title = parsed.find((s) => s.type === 'heading')?.jp_text ?? ''
      const chapId = deps.db.insertChapter(bookId, chapIdx, title)

      const segs = parsed.map((s) =>
        toSegmentInput(s, bookId, chapId, seq++, zip, imgOut, imgNames, opfBase)
      )
      deps.db.insertSegments(segs)
      segTotal += segs.length
    })

    return { bookId, chapters: docs.length, segments: segTotal, coverRef }
  } catch (e) {
    // 半途抛错（缺条目/坏 deflate/非法实体）时前面的章已提交。不清就会在书架上
    // 留一本标题正常、正文半截的鬼书，用户毫无察觉。
    try {
      deps.db.deleteBook?.(bookId)
    } catch {
      /* 回滚失败不掩盖原始错误 */
    }
    try {
      rmSync(imgOut, { recursive: true, force: true })
    } catch {
      /* 清理失败不掩盖原始错误 */
    }
    throw e
  }
}

// 把 ParsedSeg 转 SegmentInput；image 段顺带把图片从 zip 落盘。
function toSegmentInput(
  s: ParsedSeg,
  bookId: number,
  chapId: number,
  seq: number,
  zip: Zip,
  imgOut: string,
  imgNames: Map<string, string>,
  opfBase: string
): SegmentInput {
  let imageRef: string | null = null
  if (s.type === 'image' && s.image_ref) {
    // parseDoc 通常已经返回 ZIP 根路径；兼容旧 resolveImg 实现时再尝试 OPF 根相对路径。
    // 这避免把 OEBPS/Images/foo.jpg 错拼成 OEBPS/OEBPS/Images/foo.jpg。
    const normalized = posix.normalize(s.image_ref)
    const opfRelative = opfBase === '.' ? normalized : posix.join(opfBase, normalized)
    const zipPath = zip.has(normalized) ? normalized : opfRelative
    let base = imgNames.get(zipPath)
    if (base === undefined) {
      // 落盘名只取 basename：img/ch1/001.jpg 与 img/ch2/001.jpg（按章分目录的常见排版）
      // 会互相覆盖，两段指向同一张图。故重名时按全路径派生唯一名。
      base = uniqueImageName(posix.basename(zipPath), zipPath, new Set(imgNames.values()))
      if (zip.has(zipPath)) {
        mkdirSync(imgOut, { recursive: true })
        writeFileSync(join(imgOut, base), zip.read(zipPath))
      }
      imgNames.set(zipPath, base)
    }
    // image_ref 存相对 booksRoot 路径（getImagePath 反解为绝对路径）。
    imageRef = posix.join(String(bookId), 'images', base)
  }
  return {
    book_id: bookId,
    chapter_id: chapId,
    seq,
    type: s.type,
    jp_text: s.jp_text,
    zh_text: s.zh_text,
    zh_source: s.type === 'image' ? null : s.zh_text ? 'builtin' : null,
    ruby: s.ruby,
    image_ref: imageRef
  }
}

// 同名不同源的图片：在扩展名前插入全路径的短哈希，稳定且不与已用名冲突。
function uniqueImageName(base: string, zipPath: string, used: Set<string>): string {
  if (!used.has(base)) return base
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot) : ''
  let h = 0
  for (let i = 0; i < zipPath.length; i++) h = (h * 31 + zipPath.charCodeAt(i)) >>> 0
  let name = `${stem}_${h.toString(36)}${ext}`
  let n = 1
  while (used.has(name)) name = `${stem}_${h.toString(36)}_${n++}${ext}`
  return name
}
