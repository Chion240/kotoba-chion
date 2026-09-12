// library 进度往返自测（CR-1 的 deleteProgress + 契约 4 saveProgress/getProgress）。
// electron-store 是 ESM、纯 JS（不依赖 native ABI），故用普通 node 跑（非 electron-node）。
// 跑法：node scripts/progress-selftest.mjs
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const storageDir = resolve(here, '../src/main/modules/storage')

// 转 progress.ts（只 import electron-store，落回 storage 目录内向上解析 node_modules）。
const src = readFileSync(join(storageDir, 'progress.ts'), 'utf8')
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const tmpMod = join(storageDir, '__selftest_progress.mjs')
writeFileSync(tmpMod, js)

const cwd = mkdtempSync(join(tmpdir(), 'chion-prog-'))
let ok = false
try {
  const { openProgress } = await import('file://' + tmpMod.replace(/\\/g, '/'))
  const p = openProgress(cwd)

  // ① 未读时无进度。
  assert.strictEqual(p.getProgress(1), null, '未读无进度')
  // ② 打开书保存进度 → 读回（打开书跳位靠此）。
  p.saveProgress(1, 42)
  assert.strictEqual(p.getProgress(1).seq, 42, '进度落库并读回')
  // ③ 覆盖更新。
  p.saveProgress(1, 100)
  assert.strictEqual(p.getProgress(1).seq, 100, '进度可更新')
  // ④ 多书独立。
  p.saveProgress(2, 7)
  assert.strictEqual(p.getProgress(1).seq, 100)
  assert.strictEqual(p.getProgress(2).seq, 7)
  // ⑤ 删书清进度（CR-1 deleteProgress），不影响他书。
  p.deleteProgress(1)
  assert.strictEqual(p.getProgress(1), null, '删书后进度清空')
  assert.strictEqual(p.getProgress(2).seq, 7, '他书进度不受影响')

  ok = true
  console.log('OK: 进度往返全绿（saveProgress→getProgress 跳位 · 更新 · 多书独立 · deleteProgress 清除）')
} finally {
  rmSync(tmpMod, { force: true })
  rmSync(cwd, { recursive: true, force: true })
}
if (!ok) process.exit(1)
