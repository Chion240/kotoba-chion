// dev 播种：把仓库根真实 epub 导入生产 userData 库，使 bookId=1 存在 —— 供 reader-view
// 手动自测（滚动/分词/中文展开/图片）。library 会话做完导入 UI 后此脚本可弃。
// 跑法：npm run seed:book（经 run-seed-book.mjs 用 electron ABI 拉起）。
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import assert from 'node:assert'
import { homedir } from 'node:os'
import ts from 'typescript'

// ELECTRON_RUN_AS_NODE 下 electron API 不可用，手算 userData（electron 默认规则：应用名=package.name）。
function userDataDir(appName) {
  if (process.platform === 'win32') return join(process.env.APPDATA, appName)
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', appName)
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), appName)
}

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const impDir = resolve(root, 'src/main/modules/epub-import')
const stoDir = resolve(root, 'src/main/modules/storage')

const tmpMods = []
function transpile(dir, name) {
  const srcTs = readFileSync(join(dir, name + '.ts'), 'utf8')
  let js = ts.transpileModule(srcTs, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText
  js = js.replace(/from ['"](\.[^'"]*)['"]/g, (_, p) => `from '${p}.mjs'`)
  js = js.replace(/from '\.\/([a-z]+)\.mjs'/g, "from './__seed_$1.mjs'")
  const out = join(dir, `__seed_${name}.mjs`)
  writeFileSync(out, js)
  tmpMods.push(out)
  return out
}

async function main() {
  transpile(impDir, 'zip')
  transpile(impDir, 'parse')
  const importMod = transpile(impDir, 'import')
  const dbMod = transpile(stoDir, 'db')

  const { importBook } = await import('file://' + importMod.replace(/\\/g, '/'))
  const { openDb } = await import('file://' + dbMod.replace(/\\/g, '/'))

  const epub = resolve(root, 'jp-zh.Yg.楽園ノイズ.epub')
  assert.ok(existsSync(epub), '仓库根应有测试 epub')

  const userData = userDataDir('kotoba-chion')
  const db = openDb(join(userData, 'chion.db'))
  const booksRoot = join(userData, 'books')
  const res = importBook(epub, 'bilingual', { db, booksRoot })
  db.close()
  console.log(`已播种 bookId=${res.bookId}：${res.chapters} 章 / ${res.segments} 段 → ${userData}`)
}

try {
  await main()
} finally {
  for (const m of tmpMods) rmSync(m, { force: true })
}
