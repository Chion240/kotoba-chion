// ai-analysis 最小自测（铁律 4，纯逻辑无网络）：
//   ① 逻辑日 03:00 跨界（logical-day.ts）
//   ② SSE 解析：多 chunk / [DONE] / 跨 chunk 半行拼回（ai-client.ts parseSSE）
//   ③ 会话状态迁移 + messages 累积（session-logic.ts）
//   ④ 存档同日合并 / 跨日分开（logical-day.ts appendRound）
// 流式 fetch / React / IPC / electron-store 靠 typecheck+build+dev 手验（需网络/DOM/Electron）。
// 跑法：node scripts/ai-selftest.mjs
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import assert from 'node:assert'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const storeDir = resolve(root, 'src/main/modules/ai-store')
const aiDir = resolve(root, 'src/renderer/src/modules/ai-analysis')

// 转纯逻辑 TS（type-only import 擦除，无 DOM/electron）→ 临时 .mjs 加载。
function load(dir, name) {
  const src = readFileSync(join(dir, name + '.ts'), 'utf8')
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const out = join(dir, `__selftest_${name}.mjs`)
  writeFileSync(out, js)
  return out
}
const toUrl = (p) => 'file://' + p.replace(/\\/g, '/')

const ldPath = load(storeDir, 'logical-day')
const sseParth = load(aiDir, 'ai-client')
const slPath = load(aiDir, 'session-logic')

let ok = false
try {
  const { logicalDay, appendRound } = await import(toUrl(ldPath))
  const { parseSSE } = await import(toUrl(sseParth))
  const { sessionReducer, initialSession } = await import(toUrl(slPath))

  // ① 逻辑日 03:00 跨界（本地时间构造 → ts-3h 取本地日期）。
  const mk = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi, 0, 0).getTime()
  assert.strictEqual(logicalDay(mk(2026, 7, 16, 2, 59)), '2026-07-15', '02:59 归前一天')
  assert.strictEqual(logicalDay(mk(2026, 7, 16, 3, 0)), '2026-07-16', '03:00 归当天')
  assert.strictEqual(logicalDay(mk(2026, 7, 16, 23, 0)), '2026-07-16', '23:00 归当天')
  assert.strictEqual(logicalDay(mk(2026, 7, 16, 0, 30)), '2026-07-15', '凌晨 00:30 归前一天')

  // ② SSE 解析：多 chunk 累积 + [DONE] + 跨 chunk 半行拼回。
  const c1 = 'data: {"choices":[{"delta":{"content":"你"}}]}\n'
  let r = parseSSE('', c1)
  assert.deepStrictEqual(r.deltas, ['你'], '单帧取 delta')
  assert.strictEqual(r.buffer, '', '完整行无残余')
  // 跨 chunk 半行：前半 + 后半分两次喂，buffer 拼回。
  const half = 'data: {"choices":[{"delta":{"content":"好'
  const rest = '吗"}}]}\ndata: [DONE]\n'
  let r2 = parseSSE('', half)
  assert.deepStrictEqual(r2.deltas, [], '半行不产出')
  assert.ok(r2.buffer.length > 0, '半行留 buffer')
  const r3 = parseSSE(r2.buffer, rest)
  assert.deepStrictEqual(r3.deltas, ['好吗'], '半行拼回完整帧')
  assert.strictEqual(r3.done, true, '[DONE] 置 done')
  // 多 delta 一次到达。
  const multi = parseSSE(
    '',
    'data: {"choices":[{"delta":{"content":"A"}}]}\ndata: {"choices":[{"delta":{"content":"B"}}]}\n'
  )
  assert.deepStrictEqual(multi.deltas, ['A', 'B'], '多帧一次取全')

  // ③ 会话状态迁移 + messages 累积。
  let s = initialSession
  assert.strictEqual(s.status, 'idle')
  s = sessionReducer(s, { type: 'startRound', userText: '走る' })
  assert.strictEqual(s.status, 'streaming', 'startRound → streaming')
  assert.strictEqual(s.messages.length, 2, '推入 [user, 空 assistant]')
  assert.strictEqual(s.messages[0].content, '走る')
  assert.strictEqual(s.messages[1].content, '', 'assistant 初始空')
  s = sessionReducer(s, { type: 'appendDelta', delta: '这是' })
  s = sessionReducer(s, { type: 'appendDelta', delta: '动词' })
  assert.strictEqual(s.messages[1].content, '这是动词', 'delta 累积到最后 assistant')
  s = sessionReducer(s, { type: 'finish' })
  assert.strictEqual(s.status, 'done', 'finish → done')
  // 多轮累积：再发一轮，messages 增长不清空。
  s = sessionReducer(s, { type: 'startRound', userText: '次の質問' })
  assert.strictEqual(s.messages.length, 4, '多轮累积 messages')
  // 取消保留已收部分，落 done。
  s = sessionReducer(s, { type: 'appendDelta', delta: '半截' })
  s = sessionReducer(s, { type: 'cancel' })
  assert.strictEqual(s.status, 'done', 'cancel → done')
  assert.strictEqual(s.messages[3].content, '半截', '取消保留已收部分')
  // fail 落 error 带信息。
  const errS = sessionReducer(initialSession, { type: 'fail', error: '网络炸了' })
  assert.strictEqual(errS.status, 'error')
  assert.strictEqual(errS.error, '网络炸了')
  // reset 清空。
  assert.strictEqual(sessionReducer(s, { type: 'reset' }).messages.length, 0, 'reset 清空')
  // 不可变：reducer 不改入参。
  const frozen = sessionReducer(initialSession, { type: 'startRound', userText: 'x' })
  const lenBefore = frozen.messages.length
  sessionReducer(frozen, { type: 'appendDelta', delta: 'y' })
  assert.strictEqual(frozen.messages.length, lenBefore, 'reducer 不改入参')
  assert.strictEqual(frozen.messages[1].content, '', 'appendDelta 不改入参 assistant')

  // ④ 存档同日合并 / 跨日分开。
  const day1a = { userText: 'a', assistantText: 'A', ts: mk(2026, 7, 16, 10, 0) }
  const day1b = { userText: 'b', assistantText: 'B', ts: mk(2026, 7, 16, 23, 30) } // 同逻辑日
  const day2 = { userText: 'c', assistantText: 'C', ts: mk(2026, 7, 17, 10, 0) } // 跨日
  let days = appendRound([], day1a)
  days = appendRound(days, day1b)
  assert.strictEqual(days.length, 1, '同逻辑日合并为一天')
  assert.strictEqual(days[0].rounds.length, 2, '同日两轮累积')
  assert.strictEqual(days[0].day, '2026-07-16')
  days = appendRound(days, day2)
  assert.strictEqual(days.length, 2, '跨日分开两天')
  assert.strictEqual(days[1].day, '2026-07-17')
  // 凌晨归前一天：17 日 01:00 应并入 16 日逻辑日？—— 不，已有 16/17；01:00 归 16。
  const dawn = { userText: 'd', assistantText: 'D', ts: mk(2026, 7, 17, 1, 0) }
  const days2 = appendRound(days, dawn)
  assert.strictEqual(days2.length, 2, '17 日凌晨并入 16 日逻辑日，不新增')
  assert.strictEqual(days2[0].rounds.length, 3, '并入 16 日')
  // 不改入参。
  assert.strictEqual(days[0].rounds.length, 2, 'appendRound 不改入参')

  ok = true
  console.log(
    'OK: ai-analysis 全绿（逻辑日 03:00 跨界 · SSE 多chunk/[DONE]/半行拼回 · 会话迁移+累积+取消+不可变 · 存档同日合并/跨日分开）'
  )
} finally {
  rmSync(ldPath, { force: true })
  rmSync(sseParth, { force: true })
  rmSync(slPath, { force: true })
}
if (!ok) process.exit(1)
