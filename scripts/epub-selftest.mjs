// epub-import 最小自测（铁律 4）：用仓库根真实 epub 跑 importBook，断言段数/配对/日文没被误藏。
// 跑法：ELECTRON_RUN_AS_NODE=1 electron scripts/epub-selftest.mjs（匹配 better-sqlite3 的 Electron ABI）。
import { readFileSync, writeFileSync, rmSync, mkdtempSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const impDir = resolve(root, 'src/main/modules/epub-import')
const stoDir = resolve(root, 'src/main/modules/storage')

// 把 .ts 转成临时 .mjs（相对 import 补 .mjs 后缀），落回源目录 → node_modules 照常向上解析。
const tmpMods = []
function transpile(dir, name) {
  const src = readFileSync(join(dir, name + '.ts'), 'utf8')
  let js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText
  js = js.replace(/from ['"](\.[^'"]*)['"]/g, (_, p) => `from '${p}.mjs'`)
  const out = join(dir, `__selftest_${name}.mjs`)
  // 相对 import 指向同目录的 __selftest_ 前缀文件
  js = js.replace(/from '\.\/([a-z]+)\.mjs'/g, "from './__selftest_$1.mjs'")
  writeFileSync(out, js)
  tmpMods.push(out)
  return out
}

const tmpDir = mkdtempSync(join(tmpdir(), 'chion-epub-'))
let ok = false
try {
  transpile(impDir, 'zip')
  const parseMod = transpile(impDir, 'parse')
  const importMod = transpile(impDir, 'import')
  const dbMod = transpile(stoDir, 'db')

  const { importBook } = await import('file://' + importMod.replace(/\\/g, '/'))
  const { openDb } = await import('file://' + dbMod.replace(/\\/g, '/'))
  const { plainText, parseDoc } = await import('file://' + parseMod.replace(/\\/g, '/'))

  // ⓪ plainText 空格污染修复（会话 9 问题 3）：作者注音标签被 calibre 缩进换行，
  //   删标签后残留夹在汉字/假名间的空白 → 必须清；拉丁词间单空格必须保留。
  const polluted = '骨色の\n    <ruby>魔<rt>ま</rt></ruby>\n    <ruby>法<rt>ほう</rt></ruby>'
  assert.strictEqual(plainText(polluted), '骨色の魔法', `CJK 间空白应清除，实得「${plainText(polluted)}」`)
  const kanaGap = 'これが\n  きっと\n  楽園'
  assert.strictEqual(plainText(kanaGap), 'これがきっと楽園', '假名/汉字间空白应清除')
  const latin = '<p>Paradise\n  Coldplay</p>'
  assert.strictEqual(plainText(latin), 'Paradise Coldplay', '拉丁词间单空格必须保留')
  const mixed = '君と<ruby>魔<rt>ま</rt></ruby>\n  法'
  assert.strictEqual(plainText(mixed), '君と魔法', 'CJK 间（含标签间隙）空白清除')
  const svgImage = parseDoc(
    '<body><svg><image xlink:href="../Images/fixed.jpg" /></svg></body>',
    'jp',
    (src) => `OEBPS/Text/${src}`
  )
  assert.strictEqual(svgImage[0]?.type, 'image', 'SVG image 应识别为图片段')
  assert.strictEqual(svgImage[0]?.image_ref, 'OEBPS/Text/../Images/fixed.jpg')

  const epub = process.env.CHION_TEST_EPUB || resolve(root, 'jp-zh.Yg.楽園ノイズ.epub')
  if (!existsSync(epub)) {
    // 测试 epub 被 .gitignore 排除（版权），克隆下来的仓库没有——纯函数部分已测过，
    // 集成部分跳过而非崩溃（放测试书到仓库根即可跑全量）。
    console.log('OK: epub-import 纯函数全绿（plainText 空格污染 4 例）；测试 epub 不在仓库根，集成部分跳过')
    ok = true
  } else {

  const db = openDb(join(tmpDir, 'test.db'))
  const booksRoot = join(tmpDir, 'books')
  const res = importBook(epub, 'bilingual', { db, booksRoot })

  // ① 段数、章数合理（>0）。
  assert.ok(res.segments > 0, '应导入若干段')
  assert.ok(res.chapters > 0, '应有若干章')
  assert.ok(res.coverRef, '应识别 EPUB 封面')
  assert.ok(existsSync(join(booksRoot, res.coverRef)), `封面应落盘：${res.coverRef}`)
  const listed = db.listBooks().find((book) => book.id === res.bookId)
  assert.strictEqual(listed?.cover_ref, res.coverRef, '书架元数据应保存封面路径')
  console.log(`导入：${res.chapters} 章 / ${res.segments} 段 / bookId=${res.bookId}`)

  const all = db.getSegments(res.bookId, 0, res.segments - 1)
  assert.strictEqual(all.length, res.segments, '读回段数应等于写入')

  // ② seq 从 0 连续递增（总纲问题 8：按文档流分配）。
  all.forEach((s, i) => assert.strictEqual(s.seq, i, `seq 应连续，位置 ${i}`))

  // ③ 三型都在。
  const types = new Set(all.map((s) => s.type))
  assert.ok(types.has('pair'), '应有 pair 段')
  assert.ok(types.has('image'), '应有 image 段')

  // ④/⑤ 仓库 fixture 的内容断言；外部 EPUB 只跑结构和图片通用断言。
  if (!process.env.CHION_TEST_EPUB) {
    const known = all.find((s) => s.jp_text.includes('これがきっと楽園というもの'))
    assert.ok(known, '应找到已知日文段')
    assert.strictEqual(known.type, 'pair')
    assert.ok(known.zh_text.includes('乐园'), `该段应配上中文译文，实得「${known.zh_text}」`)
    assert.strictEqual(known.zh_source, 'builtin', '双语书内置译文应标 builtin')

    const withRuby = all.find((s) => s.ruby.some((r) => r.base === '荒' && r.rt === 'あ'))
    assert.ok(withRuby, 'ruby「荒→あ」应被解析')
  }

  // ⑥ 日文绝不被误藏：每个 pair 段 jp_text 非空（总纲第 3 节铁律）。
  const emptyJp = all.filter((s) => s.type === 'pair' && s.jp_text === '')
  assert.strictEqual(emptyJp.length, 0, `pair 段日文不得为空，违规 ${emptyJp.length} 段`)

  // ⑦ 含假名的日文段不得被当中文丢弃：抽含假名的 pair，jp_text 必须含假名。
  const kanaPairs = all.filter((s) => s.type === 'pair' && /[\u3040-\u30ff]/.test(s.jp_text))
  assert.ok(kanaPairs.length > 10, '应有大量含假名日文段')

  // ⑦b 全书无空格污染（会话 9 问题 3）：任何 pair/heading 的 jp_text 里不得出现「CJK 字 空格 CJK 字」。
  const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/
  const gapRe = new RegExp(`${CJK.source}[ \\u3000]${CJK.source}`)
  const polluted2 = all.filter((s) => s.type !== 'image' && gapRe.test(s.jp_text))
  assert.strictEqual(
    polluted2.length,
    0,
    `不得有 CJK 间空格污染，违规 ${polluted2.length} 段，例：「${polluted2[0]?.jp_text}」`
  )

  // ⑧ 图片落盘：image 段的 image_ref 指向的文件真的写到了 booksRoot。
  const imgSeg = all.find((s) => s.type === 'image' && s.image_ref)
  assert.ok(imgSeg, '应有带 image_ref 的图片段')
  assert.ok(existsSync(join(booksRoot, imgSeg.image_ref)), `图片应落盘：${imgSeg.image_ref}`)
  const imgFiles = readdirSync(join(booksRoot, String(res.bookId), 'images'))
  assert.ok(imgFiles.length > 0, 'images 目录应有文件')

  db.close()
  ok = true
  console.log(
    `OK: epub-import 契约 4 全绿（${res.segments} 段，配对/ruby/日文未误藏/图片落盘 ${imgFiles.length} 张）`
  )
  }
} finally {
  for (const m of tmpMods) rmSync(m, { force: true })
  // Windows 可能在 better-sqlite3 关闭后短暂持有文件句柄，清理失败不应掩盖真正断言。
  try {
    rmSync(tmpDir, { recursive: true, force: true })
  } catch {
    // 临时目录可由系统稍后回收。
  }
}
if (!ok) process.exit(1)
