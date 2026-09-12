// 用 electron 内置 node 跑播种脚本（匹配 better-sqlite3 的 Electron ABI，且 app.getPath 可用）。
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const electron = require('electron')

const r = spawnSync(electron, [resolve(here, 'seed-book.mjs')], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
})
process.exit(r.status ?? 1)
