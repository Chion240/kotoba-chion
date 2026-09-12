// 用 electron 的内置 node 跑 storage 自测（匹配 better-sqlite3 的 Electron ABI）。
// 跨平台设置 ELECTRON_RUN_AS_NODE，免装 cross-env。
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const electron = require('electron') // 返回 electron 可执行文件路径

const r = spawnSync(electron, [resolve(here, 'storage-selftest.mjs')], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
})
process.exit(r.status ?? 1)
