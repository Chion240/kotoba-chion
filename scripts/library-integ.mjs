// library 集成自测（CR-1 storage db 扩展往返）：对真 SQLite 验 listBooks/deleteBook。
//   证明「入库→书架列出（排序）→删书清 segments/chapters/books」闭环。进度往返见 test:progress。
// 跑法：ELECTRON_RUN_AS_NODE=1 electron scripts/library-integ.mjs（匹配 better-sqlite3 Electron ABI）。
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const storageDir = resolve(here, '../src/main/modules/storage')

function transpile(name) {
  const src = readFileSync(join(storageDir, name + '.ts'), 'utf8')
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const out = join(storageDir, `__integ_${name}.mjs`)
  writeFileSync(out, js)
  return out
}

const toUrl = (p) => 'file://' + p.replace(/\\/g, '/')
const dbMod = transpile('db')
const tmpDir = mkdtempSync(join(tmpdir(), 'chion-lib-'))
let ok = false
try {
  const { openDb } = await import(toUrl(dbMod))
  const db = openDb(join(tmpDir, 'test.db'))

  // 入库两本（模拟导入）。b1 两章：ch1「序」(seq0..1) + ch2 空标题(seq2..3)。
  const b1 = db.insertBook('楽園ノイズ', 'bilingual')
  const c1 = db.insertChapter(b1, 0, '序')
  const c2 = db.insertChapter(b1, 1, '') // 空标题章（决策 1：渲染层补占位）
  db.insertSegments([
    { book_id: b1, chapter_id: c1, seq: 0, type: 'pair', jp_text: '本文', zh_text: '正文',
      zh_source: 'builtin', ruby: [], image_ref: null },
    { book_id: b1, chapter_id: c1, seq: 1, type: 'pair', jp_text: '次', zh_text: '下',
      zh_source: 'builtin', ruby: [], image_ref: null },
    { book_id: b1, chapter_id: c2, seq: 2, type: 'image', jp_text: '', zh_text: '',
      zh_source: null, ruby: [], image_ref: '1/images/a.jpg' },
    { book_id: b1, chapter_id: c2, seq: 3, type: 'pair', jp_text: '終', zh_text: '完',
      zh_source: 'builtin', ruby: [], image_ref: null }
  ])
  const b2 = db.insertBook('吾輩は猫である', 'jp')

  // ①b listChapters（CR-2）：两章，含每章起止全局 seq，按 startSeq 升序。
  const chs = db.listChapters(b1)
  assert.strictEqual(chs.length, 2, 'listChapters 应列出 2 章')
  assert.strictEqual(chs[0].title, '序')
  assert.strictEqual(chs[0].ordinal, 0)
  assert.strictEqual(chs[0].startSeq, 0, '第1章首段 seq')
  assert.strictEqual(chs[0].endSeq, 1, '第1章末段 seq')
  assert.strictEqual(chs[1].title, '', '空标题章 title 为空（渲染层补占位）')
  assert.strictEqual(chs[1].startSeq, 2, '第2章首段 seq')
  assert.strictEqual(chs[1].endSeq, 3, '第2章末段 seq')

  // ① 书架列出：两本，最新（b2）在前。
  const books = db.listBooks()
  assert.strictEqual(books.length, 2, 'listBooks 应列出 2 本')
  assert.strictEqual(books[0].id, b2, '最新导入在前')
  assert.strictEqual(books[0].kind, 'jp')
  assert.strictEqual(books[1].title, '楽園ノイズ')

  // ② 删书：清 db 两库（segments+chapters+books）。进度清除见 test:progress；图片目录 rmSync 由 main 编排。
  db.deleteBook(b1)
  assert.strictEqual(db.listBooks().length, 1, '删书后书架剩 1 本')
  assert.strictEqual(db.getSegments(b1, 0, 99).length, 0, '删书后段全清')
  assert.strictEqual(db.listBooks()[0].id, b2, '剩余书不受影响')

  db.close()
  ok = true
  console.log('OK: library db 往返全绿（入库→listBooks 排序→deleteBook 清库 segments/chapters/books）')
} finally {
  rmSync(dbMod, { force: true })
  // WAL 文件可能瞬时占用；清理失败不影响断言结果（临时目录会被系统回收）。
  try {
    rmSync(tmpDir, { recursive: true, force: true })
  } catch {
    /* ignore EBUSY on WAL cleanup */
  }
}
if (!ok) process.exit(1)
