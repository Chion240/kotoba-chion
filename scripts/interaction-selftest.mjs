// interaction 最小自测（铁律 4，不依赖其他模块）：验纯逻辑 ——
//   ① 契约 3 选择规则（原形/表层形、点词兜底、手势累加、覆盖语义）
//   ② 暂存 store 的覆盖语义 + 草稿保护
// clipboard/DOM/React 部分靠 typecheck+build+dev 手验（需 DOM/Electron）。
// 跑法：node scripts/interaction-selftest.mjs（纯逻辑，无 electron/DOM 依赖）。
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import assert from 'node:assert'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const dir = resolve(root, 'src/renderer/src/modules/interaction')

// selection.ts / staged-store.ts 只有 type-only import（transpile 后擦除），纯逻辑。
function load(name) {
  const src = readFileSync(join(dir, name + '.ts'), 'utf8')
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const out = join(dir, `__selftest_${name}.mjs`)
  writeFileSync(out, js)
  return out
}

// keybindings-store.ts 依赖 react(useSyncExternalStore) + localStorage：剥 react import（useKeybindings 不测），
// 注入内存 localStorage 垫片。纯逻辑（coerce/set/reset/eventCombo/matchAction）可跑。
function loadStripped(name) {
  const src = readFileSync(join(dir, name + '.ts'), 'utf8')
  let js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText
  js = js.replace(/import\s*\{[^}]*\}\s*from\s*["']react["'];?/g, '')
  // 重定向 './keybindings' → 已转好的 __selftest_keybindings.mjs（ESM 需带扩展名）。
  js = js.replace(/from\s*["']\.\/keybindings["']/g, "from './__selftest_keybindings.mjs'")
  const out = join(dir, `__selftest_${name}.mjs`)
  writeFileSync(out, js)
  return out
}

// 内存 localStorage 垫片（keybindings-store 落库用）。
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) {
    return this._m.has(k) ? this._m.get(k) : null
  },
  setItem(k, v) {
    this._m.set(k, String(v))
  },
  removeItem(k) {
    this._m.delete(k)
  }
}

const toUrl = (p) => 'file://' + p.replace(/\\/g, '/')
const selPath = load('selection')
const storePath = load('staged-store')
const kbPath = load('keybindings')
const kbStorePath = loadStripped('keybindings-store')
let ok = false
try {
  const S = await import(toUrl(selPath))
  const store = await import(toUrl(storePath))

  const tk = (surface, dictionaryForm) => ({ surface, dictionaryForm, reading: '', pos: '' })

  // ① 点词：原形进产物（喂 GoldenDict）。
  const w = S.wordItem(3, tk('読ん', '読む'))
  const sel1 = S.toSelection([w])
  assert.strictEqual(sel1.kind, 'word')
  assert.strictEqual(sel1.dictionaryForm, '読む', '单击点词带原形')
  assert.strictEqual(S.selectionText(sel1), '読む', '点词写原形喂 GoldenDict')
  assert.deepStrictEqual(sel1.seqs, [3])

  // ② 原形空/异常 → 兜底表层形（符号、未登录词）。
  const sym = S.wordItem(5, tk('、', ''))
  assert.strictEqual(S.toSelection([sym]).dictionaryForm, undefined, '空原形不带')
  assert.strictEqual(S.selectionText(S.toSelection([sym])), '、', '空原形兜底表层形')

  // ③ shift+左键 多选词：用表层形，绝不转原形（防分词错误污染）。
  let buf = []
  buf = S.accumulate(buf, S.wordItem(1, tk('走っ', '走る')), false) // 首击非 shift
  buf = S.accumulate(buf, S.wordItem(1, tk('て', 'て')), true) // shift 累加同手势
  const multi = S.toSelection(buf)
  assert.strictEqual(multi.surface, '走って', 'shift 多选拼表层形')
  assert.strictEqual(multi.dictionaryForm, undefined, '多选不带原形')
  assert.strictEqual(S.selectionText(multi), '走って', '多选写表层形')

  // ④ 覆盖语义：非 shift 新点击清空缓冲，绝不叠加跨手势。
  const buf2 = S.accumulate(buf, S.wordItem(9, tk('本', '本')), false)
  assert.deepStrictEqual(S.toSelection(buf2).seqs, [9], '非 shift 覆盖，不叠加')

  // ⑤ 右键选段：整段原文；多选段拼换行、seqs 去重保序。
  let sbuf = S.accumulate([], S.segmentItem(2, 'これは本です'), false)
  sbuf = S.accumulate(sbuf, S.segmentItem(4, '次の段'), true)
  const segSel = S.toSelection(sbuf)
  assert.strictEqual(segSel.kind, 'segment')
  assert.strictEqual(segSel.surface, 'これは本です\n次の段')
  assert.deepStrictEqual(segSel.seqs, [2, 4])

  // ⑥ 换类型（词→段）即使按 shift 也另起手势（不混选）。
  const mixed = S.accumulate([S.wordItem(1, tk('本', '本'))], S.segmentItem(2, '段'), true)
  assert.strictEqual(mixed.length, 1, '换类型不累加')
  assert.strictEqual(mixed[0].kind, 'segment')

  // ⑦ 暂存 store：选择自动填（覆盖语义）。
  store.clearStaged()
  store.stageSelection(sel1, S.selectionText(sel1))
  assert.strictEqual(store.getStaged().text, '読む', '选择自动填入暂存')
  store.stageSelection(multi, S.selectionText(multi))
  assert.strictEqual(store.getStaged().text, '走って', '新选择覆盖旧 auto 暂存')

  // ⑧ 草稿保护：用户手打后，选择不覆盖文本（但 selection 元数据更新）。
  store.setUserText('我手打的草稿')
  store.stageSelection(sel1, S.selectionText(sel1))
  assert.strictEqual(store.getStaged().text, '我手打的草稿', '有草稿时选择不覆盖')
  assert.strictEqual(store.getStaged().selection.dictionaryForm, '読む', 'selection 仍更新')

  // ⑨ 清空后回到可自动填。
  store.clearStaged()
  store.stageSelection(multi, S.selectionText(multi))
  assert.strictEqual(store.getStaged().text, '走って', '清空后可再自动填')

  // ⑩ 手打空串回落 auto（不再触发草稿保护）。
  store.setUserText('临时')
  store.setUserText('')
  store.stageSelection(sel1, S.selectionText(sel1))
  assert.strictEqual(store.getStaged().text, '読む', '空草稿不保护')

  // ⑪ stageAuto（连读同步）：无条件覆盖 + origin=auto，即使有用户草稿也覆盖（连读明确要跟随）。
  store.setUserText('用户草稿')
  store.stageAuto('第一句')
  assert.strictEqual(store.getStaged().text, '第一句', 'stageAuto 无条件覆盖用户草稿')
  assert.strictEqual(store.getStaged().origin, 'auto', 'stageAuto origin=auto 不污染草稿语义')
  store.stageAuto('第二句')
  assert.strictEqual(store.getStaged().text, '第二句', '新段覆盖旧段（不叠加，上一句清掉）')
  assert.strictEqual(store.getStaged().selection, null, 'stageAuto 不带 selection 元数据')

  // ⑫ 快捷键 eventCombo：修饰键按序拼、箭头键归一、大小写归一（会话 18）。
  const K = await import(toUrl(kbPath))
  const ev = (o) => ({ ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...o })
  assert.strictEqual(K.eventCombo(ev({ key: 't' })), 't', '单键小写')
  assert.strictEqual(K.eventCombo(ev({ key: 'T' })), 't', '大写归一小写')
  assert.strictEqual(K.eventCombo(ev({ key: 'ArrowLeft' })), 'arrowleft', '箭头左归一')
  assert.strictEqual(K.eventCombo(ev({ key: 'ArrowRight' })), 'arrowright', '箭头右归一')
  assert.strictEqual(
    K.eventCombo(ev({ key: 'Enter', ctrlKey: true, shiftKey: true })),
    'ctrl+shift+enter',
    '修饰键按序拼（ctrl→alt→shift→meta）'
  )

  // ⑬ matchAction：命中各 action / 未命中 null / 大小写不敏感。
  const kb = K.defaultKeybindings
  assert.strictEqual(K.matchAction(kb, ev({ key: 't' })), 'toggleTranslation', '命中 t')
  assert.strictEqual(K.matchAction(kb, ev({ key: 'ArrowLeft' })), 'prevChapter', '命中上一章')
  assert.strictEqual(K.matchAction(kb, ev({ key: 'ArrowRight' })), 'nextChapter', '命中下一章')
  assert.strictEqual(
    K.matchAction(kb, ev({ key: 'Enter', ctrlKey: true })),
    'sendToAi',
    '命中发送给 AI'
  )
  assert.strictEqual(K.matchAction(kb, ev({ key: 'x' })), null, '未命中返 null')
  assert.strictEqual(K.matchAction(kb, ev({ key: 'T' })), 'toggleTranslation', '大小写不敏感')

  // ⑭ coerceKeybindings：空对象→全默认 / 缺字段补默认 / 脏值回默认 / 保留合法值 / 大小写归一。
  const KB = await import(toUrl(kbStorePath))
  assert.deepStrictEqual(KB.coerceKeybindings({}), kb, '空对象→全默认')
  assert.deepStrictEqual(KB.coerceKeybindings(null), kb, 'null→全默认')
  const partial = KB.coerceKeybindings({ toggleTranslation: 'z' })
  assert.strictEqual(partial.toggleTranslation, 'z', '保留合法传入值')
  assert.strictEqual(partial.prevChapter, 'arrowleft', '缺字段补默认')
  assert.strictEqual(partial.sendToAi, 'ctrl+enter', '旧数据缺 sendToAi 时补默认')
  const legacyCollision = KB.coerceKeybindings({ toggleTranslation: 'ctrl+enter' })
  assert.strictEqual(legacyCollision.toggleTranslation, 'ctrl+enter', '保留旧数据已有快捷键')
  assert.strictEqual(
    legacyCollision.sendToAi,
    'ctrl+shift+enter',
    '旧数据占用默认发送键时为新动作选择无撞键候选'
  )
  assert.strictEqual(KB.coerceKeybindings({ nextChapter: 123 }).nextChapter, 'arrowright', '脏值(非串)回默认')
  assert.strictEqual(KB.coerceKeybindings({ nextChapter: '  ' }).nextChapter, 'arrowright', '空白串回默认')
  assert.strictEqual(KB.coerceKeybindings({ toggleTranslation: 'F5' }).toggleTranslation, 'f5', '大小写归一')

  // ⑮ store 往返：setKeybinding→持久化→读回一致；撞键返 false 不写；resetKeybindings 回默认。
  KB.resetKeybindings()
  assert.deepStrictEqual(KB.getKeybindings(), kb, 'reset 后=默认')
  assert.strictEqual(KB.setKeybinding('toggleTranslation', 'z'), true, '设新键返 true')
  assert.strictEqual(KB.getKeybindings().toggleTranslation, 'z', '写入生效')
  // 持久化读回：新实例（重导 store 模块）从 localStorage 恢复。
  const kbStore2 = loadStripped('keybindings-store')
  const KB2 = await import(toUrl(kbStore2) + '?v=2')
  assert.strictEqual(KB2.getKeybindings().toggleTranslation, 'z', '持久化读回一致')
  rmSync(kbStore2, { force: true })
  // 撞键：把 prevChapter 设成已被 toggleTranslation 占的 'z' → 返 false 不写。
  assert.strictEqual(KB.setKeybinding('prevChapter', 'z'), false, '撞键返 false')
  assert.strictEqual(KB.getKeybindings().prevChapter, 'arrowleft', '撞键不写入')
  assert.strictEqual(KB.setKeybinding('sendToAi', 'z'), false, 'AI 发送快捷键同样参与撞键检查')
  KB.resetKeybindings()
  assert.deepStrictEqual(KB.getKeybindings(), kb, 'reset 回默认')

  ok = true
  console.log('OK: interaction 全绿（点词原形/兜底表层 · shift 多选表层 · 覆盖语义 · 选段 · 草稿保护 · stageAuto连读同步 · 快捷键 eventCombo/matchAction/coerce/store往返撞键reset）')
} finally {
  rmSync(selPath, { force: true })
  rmSync(storePath, { force: true })
  rmSync(kbPath, { force: true })
  rmSync(kbStorePath, { force: true })
}
if (!ok) process.exit(1)
