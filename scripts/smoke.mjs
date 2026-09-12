// 脚手架通道烟测（不依赖其他模块 / 不依赖词典）。跑：node scripts/smoke.mjs
// 会话 1 建立时验证 echo stub；tokenizer 会话（第 2 批）把 stub 换成真 Sudachi 分词后，
// 本烟测改为验证「renderer→worker 通道 + 契约 2 响应形状」——不加载 200MB 词典（那归
// npm run test:tokenizer 做真分词断言）。这里注入 mock fetch 模拟词典不可达，断言 worker
// 走优雅降级路径：回 { seq 原样, tokens: [] }，证明消息路由与响应形状正确。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import ts from 'typescript'
import assert from 'node:assert'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(resolve(here, '../src/worker/tokenizer.worker.ts'), 'utf8')
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText

let received
const self = {
  // dev 环境下 worker 从 http 加载（file: 分支由 test:tokenizer/打包后实测覆盖）。
  location: { protocol: 'http:', href: 'http://localhost/assets/tokenizer.worker.js' },
  set onmessage(fn) {
    this._fn = fn
  },
  get onmessage() {
    return this._fn
  },
  postMessage(msg) {
    received = msg
  }
}

// mock fetch：模拟词典不可达（真分词由 test:tokenizer 覆盖，这里只验通道形状）。
const fetchMock = async () => {
  throw new Error('smoke: 词典故意不可达')
}
// createTokenizer 在降级路径前不会被调用（fetch 先失败），给个占位满足引用剥离后的作用域。
const createTokenizer = () => {
  throw new Error('smoke 不应到达此处')
}

// 剥离 import/export（顶部 import type 已被 transpile 处理；剩余 import 手动剥），
// 用 Function 注入 self / fetch / createTokenizer 作用域后执行 worker 逻辑。
const body = js
  .replace(/^import[^\n]*\n/gm, '')
  .replace(/^export\s*\{[^}]*\};?\s*$/gm, '')
new Function('self', 'fetch', 'createTokenizer', body)(self, fetchMock, createTokenizer)

// 发一条 TokenizeReq；worker 异步 fetch 词典失败 → 降级回空 tokens。
self.onmessage({ data: { seq: 42, text: 'テスト', mode: 'C' } })
// 等微任务队列跑完（fetch reject → catch → postMessage）。
await new Promise((r) => setTimeout(r, 50))

assert.deepStrictEqual(received, { seq: 42, tokens: [] }, 'worker 通道/降级契约破损')
console.log('OK: worker 通道正确（seq=42 保留；词典不可达时优雅降级 tokens=[]）')
