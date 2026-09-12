// storage 最小自测（铁律 4）：不依赖其他模块，建库→写假段落→按区间读回→断言一致。
// 跑法：ELECTRON_RUN_AS_NODE=1 electron scripts/storage-selftest.mjs
//   （用 electron 的 node 以匹配 better-sqlite3 的 Electron ABI）
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const storageDir = resolve(here, '../src/main/modules/storage')

// 把 db.ts 转成临时 .mjs，落在 storage 目录内 → 'better-sqlite3' 照常向上解析 node_modules。
const src = readFileSync(join(storageDir, 'db.ts'), 'utf8')
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const tmpMod = join(storageDir, '__selftest_db.mjs')
writeFileSync(tmpMod, js)

const tmpDir = mkdtempSync(join(tmpdir(), 'chion-storage-'))
let ok = false
try {
  const { openDb } = await import('file://' + tmpMod.replace(/\\/g, '/'))
  const db = openDb(join(tmpDir, 'test.db'))

  const bookId = db.insertBook('自测·双语书', 'bilingual')
  const chapId = db.insertChapter(bookId, 0, '第一章')

  // 假段落：覆盖三型 + ruby 结构 + zh_source 三态。
  const fake = [
    { book_id: bookId, chapter_id: chapId, seq: 0, type: 'heading', jp_text: '序章',
      zh_text: '序章', zh_source: 'builtin', ruby: [], image_ref: null },
    { book_id: bookId, chapter_id: chapId, seq: 1, type: 'pair', jp_text: '吾輩は猫である',
      zh_text: '我是猫', zh_source: 'builtin',
      ruby: [{ base: '吾輩', rt: 'わがはい' }, { base: '猫', rt: 'ねこ' }], image_ref: null },
    { book_id: bookId, chapter_id: chapId, seq: 2, type: 'pair', jp_text: '名前はまだ無い',
      zh_text: '', zh_source: null, ruby: [{ base: '名前', rt: 'なまえ' }], image_ref: null },
    { book_id: bookId, chapter_id: chapId, seq: 3, type: 'image', jp_text: '',
      zh_text: '', zh_source: null, ruby: [], image_ref: 'images/fig1.png' }
  ]
  db.insertSegments(fake)

  // 契约 4 铁律：按区间读回，断言与写入一致。
  const got = db.getSegments(bookId, 1, 2)
  assert.strictEqual(got.length, 2, '区间 [1,2] 应读回 2 段')
  assert.strictEqual(got[0].seq, 1)
  assert.strictEqual(got[0].jp_text, '吾輩は猫である')
  assert.deepStrictEqual(got[0].ruby, [{ base: '吾輩', rt: 'わがはい' }, { base: '猫', rt: 'ねこ' }],
    'ruby 结构应往返一致')
  assert.strictEqual(got[0].zh_source, 'builtin')
  assert.strictEqual(got[1].zh_source, null, '纯日语段 zh_source 应为 null')

  // saveAiTranslation：给 seq=2 落 AI 译文，标记 zh_source='ai'。
  db.saveAiTranslation(got[1].id, '还没有名字')
  const after = db.getSegments(bookId, 2, 2)[0]
  assert.strictEqual(after.zh_text, '还没有名字', 'AI 译文应落库')
  assert.strictEqual(after.zh_source, 'ai', "AI 译文应标记 zh_source='ai'")

  // 全区间 + image 段的 image_ref 往返。
  const all = db.getSegments(bookId, 0, 99)
  assert.strictEqual(all.length, 4)
  assert.strictEqual(all[3].type, 'image')
  assert.strictEqual(all[3].image_ref, 'images/fig1.png')

  db.close()
  ok = true
  console.log('OK: storage 契约 4 往返一致（建库→写 4 段→按区间读回→AI 译文落库，全绿）')
} finally {
  rmSync(tmpMod, { force: true })
  rmSync(tmpDir, { recursive: true, force: true })
}
if (!ok) process.exit(1)
