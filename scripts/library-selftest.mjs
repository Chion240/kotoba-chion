// library 最小自测（铁律 4，不依赖其他模块）：验导入流程状态机纯逻辑 ——
//   idle→选文件→选 mode(决策 6)→importing→done/error，取消/失败转移，非法转移防御。
// UI/IPC 部分靠 typecheck+build+dev 手验（需 DOM/Electron）。
// 跑法：node scripts/library-selftest.mjs（纯逻辑，无 electron/DOM 依赖）。
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import assert from 'node:assert'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const dir = resolve(here, '../src/renderer/src/modules/library')

// import-flow.ts 只有 type-only import（transpile 后擦除），纯逻辑。
const src = readFileSync(join(dir, 'import-flow.ts'), 'utf8')
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const tmp = join(dir, '__selftest_import-flow.mjs')
writeFileSync(tmp, js)

let ok = false
try {
  const { importReducer: r, initialImportState: init } = await import(
    'file://' + tmp.replace(/\\/g, '/')
  )

  // ① 起步 idle。
  assert.strictEqual(init.status, 'idle')

  // ② 选到文件 → choosing（带 path）。
  const chosen = r(init, { type: 'filePicked', path: '/x/book.epub' })
  assert.strictEqual(chosen.status, 'choosing')
  assert.strictEqual(chosen.path, '/x/book.epub')

  // ③ 用户取消选择器（null）→ 回 idle。
  assert.strictEqual(r(init, { type: 'filePicked', path: null }).status, 'idle')

  // ④ 选 mode（决策 6 手动）→ importing，带 path+mode。
  const importing = r(chosen, { type: 'modeChosen', mode: 'jp' })
  assert.strictEqual(importing.status, 'importing')
  assert.strictEqual(importing.mode, 'jp')
  assert.strictEqual(importing.path, '/x/book.epub')

  // ⑤ 成功 → 回 idle（书架刷新在 hook 里）。
  assert.strictEqual(r(importing, { type: 'succeeded' }).status, 'idle')

  // ⑥ 失败（损坏 epub reject，会话 4）→ error 带 message。
  const err = r(importing, { type: 'failed', message: 'EPUB 损坏' })
  assert.strictEqual(err.status, 'error')
  assert.strictEqual(err.message, 'EPUB 损坏')

  // ⑦ error 态可重新选文件（起步）。
  assert.strictEqual(r(err, { type: 'filePicked', path: '/y.epub' }).status, 'choosing')

  // ⑧ cancel 任意态归 idle。
  assert.strictEqual(r(chosen, { type: 'cancel' }).status, 'idle')
  assert.strictEqual(r(importing, { type: 'cancel' }).status, 'idle')

  // ⑨ 非法转移防御：idle 收 modeChosen 原样返回。
  assert.strictEqual(r(init, { type: 'modeChosen', mode: 'bilingual' }).status, 'idle')
  // choosing 中重复 filePicked 不干扰（守卫）。
  assert.strictEqual(r(chosen, { type: 'filePicked', path: '/z.epub' }).status, 'choosing')

  ok = true
  console.log('OK: library 导入状态机全绿（选文件→选mode决策6→importing→done/error · 取消/失败/非法转移）')
} finally {
  rmSync(tmp, { force: true })
}
if (!ok) process.exit(1)
