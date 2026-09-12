// IPC 契约自测：共享通道名必须唯一，避免主进程与 preload 漂移或覆盖注册。
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'src/shared/ipc.ts')
const out = join(root, 'scripts', '__ipc_contract_selftest.mjs')
try {
  const js = ts.transpileModule(readFileSync(source, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText
  writeFileSync(out, js)
  const { IPC_CHANNELS } = await import(pathToFileURL(out).href)
  const channels = Object.values(IPC_CHANNELS).flatMap((group) => Object.values(group))
  if (channels.length !== 27 || new Set(channels).size !== channels.length) {
    throw new Error(`IPC 通道契约异常：${channels.length} 个，唯一 ${new Set(channels).size} 个`)
  }
  console.log(`OK: IPC 契约全绿（${channels.length} 个通道唯一且集中定义）`)
} finally {
  rmSync(out, { force: true })
}
