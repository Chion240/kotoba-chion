// 跑 tokenizer 自测。Node 24 直接跑 .ts（类型擦除），无需构建。
// sudachi-wasm333 内联 WASM 走 Buffer/base64，纯 Node 即可，无需 electron ABI。
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const r = spawnSync(
  process.execPath,
  ['--experimental-strip-types', '--no-warnings', resolve(here, 'tokenizer-selftest.mjs')],
  { stdio: 'inherit' }
)
process.exit(r.status ?? 1)
