// tts 最小自测（铁律 4）：
//   ① normalizeForTts 逐条规则（去括号符号保内容 / 全半角 / 去emoji / 去ruby残留URL控制符 / 压空白）
//   ② sentence-split：splitSentences 切句 + sentenceAt 定位
//   ③ tts-client：buildSovitsBody/buildOpenAiBody 形状 + synthesize 入口调 normalizeForTts + fetch body
//   ④ pickUtterance：词/句/段选取 + tokenOffset
//   ⑤ playback-store：enabled/granularity 持久化 + play loading→playing / stop / 无档案error / 抢占
//   ⑥ voice-store：openVoiceStore 往返（electron-store 临时 cwd）
// 跑法：node scripts/tts-selftest.mjs
import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const ttsDir = resolve(root, 'src/renderer/src/modules/tts')
const voiceDir = resolve(root, 'src/main/modules/voice-store')
const toUrl = (p) => 'file://' + p.replace(/\\/g, '/')
const tmp = []

function load(dir, name, extra) {
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
  const { normalizeForTts, splitTtsSentences } = await import(toUrl(load(ttsDir, 'tts-text')))
  const { buildSovitsBody, buildOpenAiBody, buildRequest, synthesize } = await import(
    toUrl(
      load(ttsDir, 'tts-client', (js) =>
        js.replace(`from './tts-text'`, `from './__selftest_tts-text.mjs'`)
      )
    )
  )

  // ① normalizeForTts 逐条。
  assert.strictEqual(normalizeForTts('「おはよう」'), 'おはよう', '去括号符号保内容')
  assert.strictEqual(normalizeForTts('（注）本文'), '注本文', '全角括号只删符号')
  assert.strictEqual(normalizeForTts('Ａｂｃ１２３'), 'Abc123', '全角英数→半角')
  assert.strictEqual(normalizeForTts('こんにちは😀🎉'), 'こんにちは', '去 emoji')
  assert.strictEqual(normalizeForTts('走る<rt>はしる</rt>'), '走る', '去 ruby 残留')
  assert.strictEqual(normalizeForTts('見て https://a.b/c ね'), '見て ね', '去 URL')
  assert.strictEqual(normalizeForTts('a\u200bb'), 'ab', '去零宽控制字符')
  assert.strictEqual(normalizeForTts('  a   b  '), 'a b', '压空白+去首尾')
  assert.strictEqual(normalizeForTts(''), '', '空串')
  // 日文句末标点保留（SoVITS 断句韵律靠它）。
  assert.strictEqual(normalizeForTts('元気ですか。'), '元気ですか。', '日文句末标点保留')

  // ② 连续朗读断句：句末标点与换行切分，标点保留，逗号和英文句点不切。
  assert.deepStrictEqual(
    splitTtsSentences('最初です。次ですか？最後！'),
    ['最初です。', '次ですか？', '最後！'],
    '日文句末标点切句'
  )
  assert.deepStrictEqual(
    splitTtsSentences('本当！？\nはい! いいえ?'),
    ['本当！？', 'はい!', 'いいえ?'],
    '连续标点合并且换行切句'
  )
  assert.deepStrictEqual(
    splitTtsSentences('第一行\n第二行'),
    ['第一行', '第二行'],
    '没有句末标点时换行仍然切句'
  )
  assert.deepStrictEqual(
    splitTtsSentences('一、二、三です. 続き'),
    ['一、二、三です. 続き'],
    '逗号和英文句点不切'
  )
  assert.deepStrictEqual(splitTtsSentences('  '), [], '空白文本无朗读单元')

  await testClient(buildSovitsBody, buildOpenAiBody, buildRequest, synthesize)
  await testStore()
  await testContinuous()
  await testSharedVoiceProfiles(buildSovitsBody)
  await testVoiceStore()

  ok = true
  console.log(
    'OK: tts 全绿（normalizeForTts 逐条 · client 分派+入口规整(IPC代发) · playback playSingle/playUrl/stop/抢占 · 连读推进 firstReadableIdx/nextReadableIdx 跳image/章尾-1 · voice-store 往返）'
  )
} finally {
  for (const p of tmp) rmSync(p, { force: true })
}
if (!ok) process.exit(1)

// ③ tts-client：body 形状 + buildRequest 分派 + synthesize 入口规整（IPC 代发的 body.text 已干净）。
async function testClient(buildSovitsBody, buildOpenAiBody, buildRequest, synthesize) {
  const sovits = { engine: 'sovits', baseURL: 'http://127.0.0.1:9880/', textLang: 'ja', promptLang: 'ja', refAudioPath: '/a.wav', promptText: 'p', speedFactor: 1.2 }
  const sb = buildSovitsBody(sovits, 'あ')
  assert.strictEqual(sb.text, 'あ')
  assert.strictEqual(sb.ref_audio_path, '/a.wav', 'sovits body 含 ref_audio_path')
  assert.strictEqual(sb.prompt_lang, 'ja')
  assert.strictEqual(sb.speed_factor, 1.2, 'speed_factor 取档案 speedFactor')
  assert.strictEqual(sb.media_type, 'wav')
  const ob = buildOpenAiBody({ engine: 'openai', model: 'tts-1', voice: 'nova' }, 'hi')
  assert.strictEqual(ob.input, 'hi', 'openai body 用 input')
  assert.strictEqual(ob.voice, 'nova')

  // buildRequest 分派：sovits 打 /tts、openai 打 /audio/speech（末尾斜杠归一）。
  assert.ok(buildRequest(sovits, 'あ').url.endsWith('/tts'), 'sovits 打 /tts')
  assert.ok(
    buildRequest({ engine: 'openai', baseURL: 'http://x', apiKey: 'k' }, 'yo').url.endsWith(
      '/audio/speech'
    ),
    'openai 打 /audio/speech'
  )

  // synthesize 入口规整：脏文本进，IPC 代发的 body.text 应是干净的。
  let captured = null
  globalThis.window = {
    chion: {
      ttsSynthesize: async (req) => {
        captured = req
        return new Uint8Array([1, 2, 3, 4])
      }
    }
  }
  const buf = await synthesize(sovits, '「おはよう」😀')
  assert.ok(buf instanceof ArrayBuffer, '返 ArrayBuffer')
  assert.ok(captured.url.endsWith('/tts'), '代发 sovits /tts')
  assert.strictEqual(captured.body.text, 'おはよう', '入口 normalizeForTts 规整（去括号+emoji）')
  // 规整后空串 → 抛（调用方不该发空，不打 IPC）。
  await assert.rejects(() => synthesize(sovits, '（）😀'), /空/, '规整后空文本抛错')
}

// ⑤ playback-store：注入 fake synthesize + fake react + mock localStorage/URL/Blob/Audio。
async function testStore() {
  const storage = {}
  globalThis.localStorage = {
    getItem: (k) => storage[k] ?? null,
    setItem: (k, v) => (storage[k] = v)
  }
  // 唯一 blob URL + 追踪已吊销集合：用于回归守卫（url 不能在播放前被吊销）。
  let urlSeq = 0
  const revoked = new Set()
  globalThis.URL = {
    createObjectURL: () => `blob:${++urlSeq}`,
    revokeObjectURL: (u) => revoked.add(u)
  }
  globalThis.Blob = class {}
  let played = 0
  let lastAudio = null
  globalThis.Audio = class {
    constructor(src) {
      this.src = src
      this.onended = null
      this.onerror = null
      lastAudio = this
    }
    play() {
      played++
      return Promise.resolve()
    }
    pause() {}
  }
  const tick = () => new Promise((r) => setTimeout(r, 0))
  globalThis.__synthBehavior = 'ok'
  const fakeSynth = join(ttsDir, '__selftest_fake_client.mjs')
  writeFileSync(
    fakeSynth,
    `export async function synthesize(profile, text, signal) {
      if (globalThis.__synthBehavior === 'throw') throw new Error('boom')
      return new ArrayBuffer(8)
    }`
  )
  tmp.push(fakeSynth)
  const fakeReact = join(ttsDir, '__selftest_fake_react2.mjs')
  writeFileSync(fakeReact, `export function useSyncExternalStore() {}`)
  tmp.push(fakeReact)

  const url = load(ttsDir, 'playback-store', (js) =>
    js
      .replace(`from './tts-client'`, `from './__selftest_fake_client.mjs'`)
      .replace(`from 'react'`, `from './__selftest_fake_react2.mjs'`)
  )
  const store = await import(toUrl(url))

  // 开关持久化。
  store.setEnabled(true)
  assert.strictEqual(storage['chion-tts-enabled'], '1', '朗读模式写 localStorage')
  assert.strictEqual(store.getPlayback().enabled, true)

  const profile = { engine: 'sovits', baseURL: 'http://x' }
  // playSingle: 合成完开始播 → status 变 playing；onended 后回 idle。
  const p1 = store.playSingle(profile, 'あ')
  await tick()
  assert.strictEqual(store.getPlayback().status, 'playing', 'playSingle → playing')
  assert.strictEqual(played, 1, 'audio.play 调用一次')
  // 回归守卫（会话 18 修）：playUrl 内部 stop() 不能吊销自己刚要播的 url。
  // 修前 playSingle 提前 curUrl=url → stop() revoke → new Audio 拿死 blob → "no supported source"。
  assert.ok(lastAudio?.src && !revoked.has(lastAudio.src), '播放中的 blob URL 未被提前吊销')
  lastAudio?.onended?.()  // 模拟播完
  await p1
  assert.strictEqual(store.getPlayback().status, 'idle', 'onended → idle')
  assert.ok(revoked.has(lastAudio.src), '播完后才吊销 url（不泄漏）')

  // 无档案 → error。
  await store.playSingle(null, 'あ')
  assert.strictEqual(store.getPlayback().status, 'error', '无档案 → error')
  assert.ok(store.getPlayback().error, 'error 带信息')

  // stop → idle。
  const p2 = store.playSingle(profile, 'い')
  await tick()
  store.stop()
  await p2
  assert.strictEqual(store.getPlayback().status, 'idle', 'stop → idle')

  // 合成失败 → error。
  globalThis.__synthBehavior = 'throw'
  await store.playSingle(profile, 'う')
  assert.strictEqual(store.getPlayback().status, 'error', '合成失败 → error')

  // 空文本不发（不改 status，stop 后 idle）。
  globalThis.__synthBehavior = 'ok'
  store.stop()
  await store.playSingle(profile, '   ')
  assert.strictEqual(store.getPlayback().status, 'idle', '空文本不播')

  // setReading/setCurrentSeq/setFollowZh 持久化。
  store.setReading(true)
  assert.strictEqual(store.getPlayback().reading, true)
  store.setCurrentSeq(42)
  assert.strictEqual(store.getPlayback().currentSeq, 42)
  store.stopReading()
  assert.strictEqual(store.getPlayback().reading, false, 'stopReading → reading=false')
  assert.strictEqual(store.getPlayback().currentSeq, null, 'stopReading → currentSeq=null')
}

// ⑤b 连读推进纯函数：firstReadableIdx / nextReadableIdx（跳 image/空段、章尾返 -1）。
async function testContinuous() {
  const url = load(ttsDir, 'useContinuousReading', (js) => {
    // 只取纯函数：切到 hook 主体前 + 剔除 UI/store import，补回断句函数。
    const head = js.slice(0, js.indexOf('export type ContinuousReadingHook'))
    return (
      `import { splitTtsSentences } from './__selftest_tts-text.mjs'\n` +
      head.replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g, '')
    )
  })
  const {
    firstReadableIdx,
    nextReadableIdx,
    buildContinuousUtterances,
    voiceProfileCacheKey
  } = await import(toUrl(url))
  const segs = [
    { seq: 0, type: 'image', jp_text: '' },
    { seq: 1, type: 'pair', jp_text: 'おはよう' },
    { seq: 2, type: 'image', jp_text: '' },
    { seq: 3, type: 'heading', jp_text: '第一章' },
    { seq: 4, type: 'pair', jp_text: '' } // 空文本不朗读
  ]
  assert.strictEqual(firstReadableIdx(segs), 1, '首个可朗读跳过 image')
  assert.strictEqual(nextReadableIdx(segs, 1), 3, '下一个跳过 image 到 heading')
  assert.strictEqual(nextReadableIdx(segs, 3), -1, '之后无可朗读（空段）→ 章尾 -1')
  assert.strictEqual(firstReadableIdx([{ seq: 0, type: 'image', jp_text: '' }]), -1, '全 image → -1')

  const utterances = buildContinuousUtterances([
    { seq: 10, type: 'pair', jp_text: '第一句。第二句？' },
    { seq: 11, type: 'image', jp_text: '' },
    { seq: 12, type: 'pair', jp_text: '第三句！' }
  ])
  assert.deepStrictEqual(
    utterances,
    [
      { key: '10:0', segmentIndex: 0, segmentSeq: 10, sentenceIndex: 0, text: '第一句。' },
      { key: '10:1', segmentIndex: 0, segmentSeq: 10, sentenceIndex: 1, text: '第二句？' },
      { key: '12:0', segmentIndex: 2, segmentSeq: 12, sentenceIndex: 0, text: '第三句！' }
    ],
    '按段序和句序生成稳定朗读单元，跳过图片'
  )
  assert.notStrictEqual(
    voiceProfileCacheKey({ id: 'v1', refAudioPath: 'old.wav', speedFactor: 1 }),
    voiceProfileCacheKey({ id: 'v1', refAudioPath: 'new.wav', speedFactor: 1 }),
    '参考音频变化会让旧预取缓存失效'
  )
}

// ⑥ 共享声音档案：设置修改与 Reader 消费同一模块级快照，下一次请求立即带新参考音频。
async function testSharedVoiceProfiles(buildSovitsBody) {
  const loaded = {
    activeId: 'v1',
    profiles: [
      {
        id: 'v1',
        name: '声音',
        engine: 'sovits',
        baseURL: 'http://127.0.0.1:9880',
        refAudioPath: 'old.wav'
      }
    ]
  }
  let saved = null
  globalThis.window = {
    chion: {
      getVoiceProfiles: async () => loaded,
      saveVoiceProfiles: async (state) => {
        saved = state
      }
    }
  }
  const url = load(ttsDir, 'useVoiceProfiles', (js) =>
    js.replace(/import\s*\{[^}]*\}\s*from\s*['"]react['"]\s*;?/, '')
  )
  const voice = await import(toUrl(url))
  let notifications = 0
  const unsubscribe = voice.subscribeVoiceProfiles(() => notifications++)
  await voice.initializeVoiceProfiles()
  assert.strictEqual(voice.getVoiceProfilesSnapshot().ready, true, '异步初始化完成')
  assert.strictEqual(voice.getVoiceProfilesSnapshot().activeProfile.refAudioPath, 'old.wav')

  voice.updateVoiceProfile('v1', { refAudioPath: 'new.wav' })
  const snapshot = voice.getVoiceProfilesSnapshot()
  assert.strictEqual(snapshot.activeProfile.refAudioPath, 'new.wav', '设置修改立即进入共享快照')
  assert.strictEqual(saved.profiles[0].refAudioPath, 'new.wav', '修改同时持久化')
  assert.ok(notifications >= 2, '初始化和修改都会通知所有订阅者')
  assert.strictEqual(
    buildSovitsBody(snapshot.activeProfile, 'テスト').ref_audio_path,
    'new.wav',
    '下一次合成请求立即使用新路径'
  )
  unsubscribe()
}

// ⑦ voice-store：openVoiceStore 往返（electron-store 临时 cwd，不碰 ipcMain/dialog）。
async function testVoiceStore() {
  const dir = mkdtempSync(join(tmpdir(), 'chion-voice-'))
  // voice-store 顶层 import electron（dialog/ipcMain）——转译后剔除该 import 只测 openVoiceStore。
  const url = load(voiceDir, 'index', (js) =>
    js
      .replace(/import\s*\{\s*dialog,\s*ipcMain\s*\}\s*from\s*'electron'\s*;?/, '')
      .replace(/import\s*\{\s*IPC_CHANNELS\s*\}\s*from\s*'\.\.\/\.\.\/\.\.\/shared\/ipc'\s*;?/, '')
  )
  const { openVoiceStore, looksLikeAudio } = await import(toUrl(url))

  // looksLikeAudio：magic bytes 粗判（防把 SoVITS 返回的 JSON 错误当 wav 播）。
  const wav = new Uint8Array([0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x41,0x56,0x45]) // RIFF..WAVE
  assert.ok(looksLikeAudio(wav), 'RIFF/WAVE 认音频')
  assert.ok(looksLikeAudio(new Uint8Array([0x4f,0x67,0x67,0x53,0,0,0,0,0,0,0,0])), 'OggS 认音频')
  assert.ok(looksLikeAudio(new Uint8Array([0x66,0x4c,0x61,0x43,0,0,0,0,0,0,0,0])), 'fLaC 认音频')
  assert.ok(looksLikeAudio(new Uint8Array([0xff,0xfb,0,0,0,0,0,0,0,0,0,0])), 'mp3 帧同步认音频')
  const json = new TextEncoder().encode('{"message":"ref audio not found","code":400}')
  assert.ok(!looksLikeAudio(json), 'JSON 错误不认音频（关键：否则播成损坏 blob）')
  assert.ok(!looksLikeAudio(new Uint8Array([1,2,3])), '过短不认音频')

  const store = openVoiceStore(dir)
  assert.deepStrictEqual(store.getProfiles(), { profiles: [], activeId: '' }, '初始空')
  const state = {
    activeId: 'v1',
    profiles: [{ id: 'v1', name: '洛琪希', engine: 'sovits', baseURL: 'http://127.0.0.1:9880', refAudioPath: '/a.wav' }]
  }
  store.saveProfiles(state)
  // 新实例读同一 cwd 验证真落盘。
  const store2 = openVoiceStore(dir)
  assert.deepStrictEqual(store2.getProfiles(), state, '往返一致（真落盘）')
  rmSync(dir, { recursive: true, force: true })
}
