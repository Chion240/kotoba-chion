import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const directory = resolve(dirname(fileURLToPath(import.meta.url)), '../src/renderer/src/modules/reader-view')
const noop = () => {}
const token = { surface: '本', reading: 'ホン' }
const segment = { id: 1, seq: 0, type: 'pair', jp_text: '本', zh_text: '' }
const slots = []
let cursor = 0
const frames = new Map()
let nextFrame = 0
const browser = {
  requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame },
  cancelAnimationFrame(frame) { frames.delete(frame) },
  setTimeout,
  clearTimeout
}
const hooks = {
  ...React,
  useState(initial) {
    const index = cursor++
    if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
    return [slots[index], (value) => {
      slots[index] = typeof value === 'function' ? value(slots[index]) : value
    }]
  },
  useRef(initial) {
    const index = cursor++
    if (!(index in slots)) slots[index] = { current: initial }
    return slots[index]
  },
  useCallback: (callback) => callback,
  useEffect: noop,
  memo: (component) => component,
  useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
  startTransition: (callback) => callback()
}
const Virtuoso = () => null
const requestedRanges = []
const data = {
  chapters: [{ title: 'Test', startSeq: 0, endSeq: 1 }],
  chapterIndex: 0, segments: [segment], tokens: new Map([[0, [token]]]),
  loading: false, dictError: null, goToChapter: noop,
  tokenizeRange: (...range) => requestedRanges.push(range)
}
const playback = { currentSeq: null }
const mocks = {
  react: hooks,
  'react-virtuoso': { Virtuoso },
  'lucide-react': new Proxy({}, { get: () => noop }),
  './useReader': { useReader: () => data },
  '../interaction': { useInteraction: () => ({ onTokenClick: noop, onSegmentContextMenu: noop }) },
  '../ai-analysis': { AIPanel: noop },
  '../ai-translation': { useTranslation: () => undefined },
  '../settings': { useSettings: () => ({ mode: 'C', furigana: true }), SettingsDialog: noop },
  '../tts': {
    useVoiceProfiles: () => ({}), usePlayback: () => playback,
    useContinuousReading: () => ({}), getPlayback: () => playback
  },
  './reader-search': { useReaderSearch: () => ({}) },
  './ReaderSearchPanel': { ReaderSearchPanel: noop }
}
const modules = new Map()
function load(name) {
  if (modules.has(name)) return modules.get(name)
  const filename = resolve(directory, name)
  const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText
  const module = { exports: {} }
  runInNewContext(compiled, {
    exports: module.exports, module, window: browser,
    localStorage: { getItem: () => null },
    require(specifier) {
      if (specifier.endsWith('.css')) return {}
      if (specifier in mocks) return mocks[specifier]
      if (specifier.startsWith('.')) {
        const extension = ['TokenizedSegment', 'SegmentView', 'JapaneseText'].includes(specifier.slice(2)) ? '.tsx' : '.ts'
        return load(specifier + extension)
      }
      return require(specifier)
    }
  }, { filename })
  modules.set(name, module.exports)
  return module.exports
}
function findList(element) {
  if (!React.isValidElement(element)) return null
  if (element.type === Virtuoso) return element.props
  return React.Children.toArray(element.props.children).map(findList).find(Boolean)
}
const { Reader } = load('Reader.tsx')
function renderReader() {
  cursor = 0
  return findList(Reader({ bookId: 1 }))
}
function markup(list) {
  const element = list.itemContent(0, segment)
  const segmentElement = element.type(element.props)
  return renderToStaticMarkup(segmentElement.type(segmentElement.props))
}
let list = renderReader()
const initial = markup(list)
assert.match(initial, /class="reader-token"/)
assert.match(initial, /<rt>ほん<\/rt>/)
assert.equal(list.scrollSeekConfiguration, undefined, '快速滚动不能用占位内容代替正文')
for (let cycle = 0; cycle < 5; cycle++) {
  list.isScrolling(true)
  list = renderReader()
  assert.equal(markup(list), initial, '滚动期间词框和振假名必须保留，排版结构不能切换')
  list.rangeChanged({ startIndex: 0, endIndex: 0 })
  assert.ok(requestedRanges.length > cycle, '滚动期间必须继续请求新进入视口的分词，不能等停下')
  list.isScrolling(false)
  list = renderReader()
  assert.equal(markup(list), initial, '停止滚动不能延迟恢复或重建词框')
}
console.log('OK: Reader → SegmentView → JapaneseText 滚动前/中/后词框与振假名保持一致')

slots.length = 0
const effects = []
hooks.useEffect = (effect, dependencies) => {
  const index = cursor++
  const previous = slots[index]
  if (previous && dependencies.every((value, offset) => Object.is(value, previous.dependencies[offset]))) return
  effects.push(() => {
    previous?.cleanup?.()
    slots[index] = { dependencies, cleanup: effect() }
  })
}
const memoizedCallbacks = new Map()
hooks.useCallback = (callback, dependencies) => {
  const index = cursor++
  const previous = memoizedCallbacks.get(index)
  if (previous && dependencies.every((value, offset) => Object.is(value, previous.dependencies[offset]))) return previous.callback
  memoizedCallbacks.set(index, { callback, dependencies })
  return callback
}
const pendingTokens = new Map()
mocks['./tokenizer-client'] = {
  TokenizerClient: class {
    peek() { return undefined }
    tokenize(seq, _text, _mode, priority) {
      pendingTokens.set(seq, { done: null, priority })
      return new Promise((done) => { pendingTokens.get(seq).done = done })
    }
    dispose() {}
    key(seq, mode) { return `${seq}:${mode}` }
    reprioritize(keys) { this.priorities = keys }
  }
}
browser.chion = {
  listChapters: async () => data.chapters,
  getSegments: async () => Array.from({ length: 80 }, (_, seq) => ({ ...segment, id: seq + 1, seq }))
}
const { useReader } = load('useReader.ts')
function renderData() {
  cursor = 0
  const result = useReader(1, 'C')
  for (const effect of effects.splice(0)) effect()
  return result
}
renderData()
await Promise.resolve()
renderData()
await Promise.resolve()
let reader = renderData()
assert.equal(reader.loading, false)
reader.tokenizeRange(40, 42)
assert.ok(pendingTokens.has(39), '从中间位置向上滚动前，应预取视口上方的词框')
assert.equal(pendingTokens.keys().next().value, 40, '当前视口优先于预取段落')
reader.tokenizeRange(0, 0)
const firstTokens = [token]
const secondTokens = [{ surface: '読む', reading: 'ヨム' }]
pendingTokens.get(0).done(firstTokens)
await Promise.resolve()
assert.equal(frames.size, 1, '分词结果按帧合批')
pendingTokens.get(1).done(secondTokens)
await Promise.resolve()
assert.equal(frames.size, 1, '新结果并入同一帧，滚动时也不等待停止事件')
let firstNotifications = 0
let secondNotifications = 0
let unrelatedNotifications = 0
const unsubscribeFirst = reader.tokens.subscribe(0, () => firstNotifications++)
const unsubscribeSecond = reader.tokens.subscribe(1, () => secondNotifications++)
const unsubscribeUnrelated = reader.tokens.subscribe(70, () => unrelatedNotifications++)
for (const [frame, callback] of frames) {
  frames.delete(frame)
  callback()
}
assert.equal(reader.tokens.get(0), firstTokens, '滚动开始前的待提交词框不能丢失')
assert.equal(reader.tokens.get(1), secondTokens, '滚动期间完成的分词不能丢失')
assert.equal(firstNotifications, 1, '词框到达只更新对应段落，不依赖 Reader 重渲染')
assert.equal(secondNotifications, 1)
assert.equal(unrelatedNotifications, 0, '未变化段落不能收到更新')
reader.tokens.set(0, firstTokens)
assert.equal(firstNotifications, 1, '重复缓存命中不重复更新段落')
const requestsBefore = pendingTokens.size
reader.tokenizeRange(0, 0)
assert.equal(pendingTokens.size, requestsBefore, '相同窗口不重复排队')
unsubscribeFirst()
reader.tokens.set(0, secondTokens)
assert.equal(firstNotifications, 1, '卸载段落的订阅必须清理')
unsubscribeSecond()
unsubscribeUnrelated()
for (const slot of slots) slot?.cleanup?.()
pendingTokens.get(39)?.done(firstTokens)
await Promise.resolve()
assert.equal(frames.size, 0, '卸载后的旧分词结果不能重新排队')
console.log('OK: 上下双向预取、视口优先、帧内合批、逐段订阅和过期结果隔离')
