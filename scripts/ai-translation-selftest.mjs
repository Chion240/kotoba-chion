// ai-translation 最小自测（铁律 4，纯逻辑无 DOM/网络）：
//   ① 安全门 shouldTranslate（最重要，铁律 3）
//   ② 提示词组装 buildTranslateMessages = [system(翻译提示词), user(日文)]，不含 profile.systemPrompt
//   ③ store：loading→done(text 累积) / 去重 / error / done 后再 translate 返回缓存 / 无档案报错
// streamChat/parseSSE 已由 test:ai 覆盖，不重测；流式 fetch/落库/DOM 靠 typecheck+build+dev 手验。
// 跑法：node scripts/ai-translation-selftest.mjs
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import assert from 'node:assert'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const dir = resolve(root, 'src/renderer/src/modules/ai-translation')
const toUrl = (p) => 'file://' + p.replace(/\\/g, '/')
const tmp = []

// 转纯逻辑 TS → 临时 .mjs（type-only import 擦除）。extra: 可选源码改写（替换 import 指向 fake）。
function load(name, extra) {
  let src = readFileSync(join(dir, name + '.ts'), 'utf8')
  let js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText
  if (extra) js = extra(js)
  const out = join(dir, `__selftest_${name}.mjs`)
  writeFileSync(out, js)
  tmp.push(out)
  return out
}

let ok = false
try {
  const logic = await import(toUrl(load('translation-logic')))
  const {
    shouldTranslate,
    buildTranslateMessages,
    TRANSLATE_SYSTEM_PROMPT,
    coerceTranslationConfig,
    DEFAULT_TRANSLATION_CONFIG
  } = logic

  // ① 安全门（最重要）。
  const seg = (o) => ({ id: 1, type: 'pair', jp_text: 'あ', zh_text: '', ...o })
  assert.strictEqual(shouldTranslate('jp', seg({})), true, 'jp+pair+空zh → 翻译')
  assert.strictEqual(shouldTranslate('jp', seg({ zh_text: '你好' })), false, 'jp+已有zh → 读库复用不翻')
  assert.strictEqual(shouldTranslate('bilingual', seg({})), false, '双语+空zh → 铁律绝不翻')
  assert.strictEqual(
    shouldTranslate('bilingual', seg({ zh_text: '你好' })),
    false,
    '双语+有zh → 走内置不翻'
  )
  assert.strictEqual(shouldTranslate('jp', seg({ type: 'image', jp_text: '' })), false, 'image 段不翻')
  assert.strictEqual(shouldTranslate('jp', seg({ type: 'heading' })), true, 'jp 标题空zh 可翻')

  // ② 提示词组装：[system(翻译提示词), user(日文)]，绝不含分析用 systemPrompt。
  const msgs = buildTranslateMessages('走る')
  assert.strictEqual(msgs.length, 2, '两条 message')
  assert.strictEqual(msgs[0].role, 'system')
  assert.strictEqual(msgs[0].content, TRANSLATE_SYSTEM_PROMPT, '默认 system = 独立翻译提示词')
  assert.strictEqual(msgs[1].role, 'user')
  assert.strictEqual(msgs[1].content, '走る', 'user = 原日文')
  // 自定义提示词：传入则用它；空串回落默认常量。
  const custom = buildTranslateMessages('猫', '翻成英文')
  assert.strictEqual(custom[0].content, '翻成英文', 'system = 自定义提示词')
  assert.strictEqual(
    buildTranslateMessages('猫', '')[0].content,
    TRANSLATE_SYSTEM_PROMPT,
    '空提示词回落默认'
  )

  // ②.5 翻译配置 coerce（脏 JSON / 缺字段 → 合法，向前兼容）。
  assert.deepStrictEqual(
    coerceTranslationConfig({}),
    DEFAULT_TRANSLATION_CONFIG,
    '空对象 → 全默认'
  )
  const merged = coerceTranslationConfig({ apiKey: 'sk-x', model: 'gpt-4o', temperature: 0.3 })
  assert.strictEqual(merged.apiKey, 'sk-x', '保留传入 apiKey')
  assert.strictEqual(merged.model, 'gpt-4o', '保留传入 model')
  assert.strictEqual(merged.temperature, 0.3, '保留传入 temperature')
  assert.strictEqual(merged.baseURL, DEFAULT_TRANSLATION_CONFIG.baseURL, '缺 baseURL 兜底默认')
  assert.strictEqual(
    coerceTranslationConfig({ systemPrompt: '' }).systemPrompt,
    TRANSLATE_SYSTEM_PROMPT,
    '空提示词兜底默认常量'
  )
  assert.strictEqual(
    coerceTranslationConfig({ temperature: 'x' }).temperature,
    DEFAULT_TRANSLATION_CONFIG.temperature,
    '脏 temperature 兜底'
  )
  assert.strictEqual(coerceTranslationConfig(null).apiKey, '', 'null 输入不炸 → 默认')

  await testStore()

  ok = true
  console.log(
    'OK: ai-translation 全绿（安全门 jp/双语/image/已有zh · 提示词组装(独立提示词非分析prompt) · store loading→done累积/去重/error/缓存/无档案报错）'
  )
} finally {
  for (const p of tmp) rmSync(p, { force: true })
}
if (!ok) process.exit(1)

// ③ store：注入 fake translateSegment（不打网络）+ fake translation-config（连接读它）+ mock window.chion。
async function testStore() {
  const saved = []
  globalThis.window = { chion: { saveAiTranslation: (id, zh) => saved.push([id, zh]) } }
  globalThis.__calls = 0
  globalThis.__behavior = 'ok'
  globalThis.__apiKey = 'k' // fake config 的 apiKey（空/空白 → 触发未配置 error）

  // fake ./translate：受 globalThis.__behavior 驱动；onDelta 分次冒出模拟流式。
  const fakeTranslate = join(dir, '__selftest_fake_translate.mjs')
  writeFileSync(
    fakeTranslate,
    `export async function translateSegment(config, jp, opts = {}) {
      globalThis.__calls++
      if (globalThis.__behavior === 'throw') throw new Error('boom')
      if (opts.onDelta) { opts.onDelta('你'); opts.onDelta('好') }
      return '你好'
    }`
  )
  tmp.push(fakeTranslate)
  // fake ./translation-config：translate 内部读 getTranslationConfig 拿连接。
  const fakeConfig = join(dir, '__selftest_fake_config.mjs')
  writeFileSync(
    fakeConfig,
    `export function getTranslationConfig() {
      return { baseURL: 'u', apiKey: globalThis.__apiKey, model: 'm', systemPrompt: 'p' }
    }`
  )
  tmp.push(fakeConfig)
  // fake react：只需 useSyncExternalStore（store 顶层 import，测非 hook 路径不调用它）。
  const fakeReact = join(dir, '__selftest_fake_react.mjs')
  writeFileSync(fakeReact, `export function useSyncExternalStore() {}`)
  tmp.push(fakeReact)

  const storeUrl = load('translation-store', (js) =>
    js
      .replace(`from './translate'`, `from './__selftest_fake_translate.mjs'`)
      .replace(`from './translation-config'`, `from './__selftest_fake_config.mjs'`)
      .replace(`from 'react'`, `from './__selftest_fake_react.mjs'`)
  )
  const store = await import(toUrl(storeUrl))

  // loading→done + text 累积（流式两 delta 累积成整串）。
  await store.translate(1, 'あ')
  assert.strictEqual(store.getTranslation(1).status, 'done', 'done 态')
  assert.strictEqual(store.getTranslation(1).text, '你好', 'text 累积/整串')
  assert.strictEqual(globalThis.__calls, 1, '一次请求')
  assert.deepStrictEqual(saved[0], [1, '你好'], '收完落库 saveAiTranslation')

  // done 后再 translate 同 segId → 直接返回缓存，不重发。
  await store.translate(1, 'あ')
  assert.strictEqual(globalThis.__calls, 1, 'done 后再 translate 返回缓存不重发')

  // 去重：并发两次同 segId（loading 中）只发一次。
  globalThis.__calls = 0
  const p1 = store.translate(2, 'い')
  const p2 = store.translate(2, 'い') // 见 loading → 直接返回
  await Promise.all([p1, p2])
  assert.strictEqual(globalThis.__calls, 1, '并发同 segId 去重只发一次')

  // error 态。
  globalThis.__behavior = 'throw'
  await store.translate(3, 'う')
  assert.strictEqual(store.getTranslation(3).status, 'error', 'error 态')
  assert.ok(store.getTranslation(3).error, 'error 带信息')

  // error 允许重试：behavior 恢复 → 再 translate 同 segId 重发成功。
  globalThis.__behavior = 'ok'
  globalThis.__calls = 0
  await store.translate(3, 'う')
  assert.strictEqual(store.getTranslation(3).status, 'done', 'error 后重试 → done')
  assert.strictEqual(globalThis.__calls, 1, 'error 态允许重发')

  // 未配置翻译 API（空 apiKey）→ error，不发请求。
  globalThis.__calls = 0
  globalThis.__apiKey = '  '
  await store.translate(4, 'え')
  assert.strictEqual(store.getTranslation(4).status, 'error', '空 apiKey → error')
  assert.strictEqual(globalThis.__calls, 0, '未配置不发请求')
}
