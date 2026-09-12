// tts · 播放会话 store（模块级单一真值）。
// Phase 2 重构：拆「合成」和「播放」两步支持连读预取无缝衔接。
// synthesizeToUrl: 合成→blob URL（供连读预取缓存）。
// playUrl: 只播已合成的 URL，await 播完（供连读编排 await 推进）。
// playSingle: 合成+播（单段点击即播，左键读词/右键读段）。
// 连读状态（reading/currentSeq/followZh）由 useContinuousReading 驱动，store 只是真值容器。
import { useSyncExternalStore } from 'react'
import type { VoiceProfile } from '../../../../shared/contracts'
import { synthesize } from './tts-client'

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'error'

export type PlaybackState = {
  enabled: boolean     // 朗读模式开关（ON 时点词/点段同时触发朗读）
  status: PlaybackStatus
  error?: string
  reading: boolean           // 连读运行中
  currentSeq: number | null  // 当前朗读段 seq（驱动高亮/滚屏）
}

const KEY_ENABLED = 'chion-tts-enabled'

function readEnabled(): boolean {
  try { return localStorage.getItem(KEY_ENABLED) === '1' } catch { return false }
}

let state: PlaybackState = {
  enabled: readEnabled(),
  status: 'idle',
  reading: false,
  currentSeq: null
}
const listeners = new Set<() => void>()
let curAudio: HTMLAudioElement | null = null
let curUrl: string | null = null
let curAbort: AbortController | null = null
// playUrl 的 resolve 回调（stop 时调 'stopped'）。
let curPlayResolve: ((result: PlayResult) => void) | null = null

// 播放结果：done=正常播完；stopped=被抢占/主动停；error=音频本身放不出来。
// error 必须与 stopped 区分：连读编排把 stopped 当「别人接管了」直接 return，
// 若解码失败也报 stopped，连读会卡在 reading=true 且高亮不动，看着像死机。
export type PlayResult = 'done' | 'stopped' | 'error'

function emit(): void { for (const l of listeners) l() }
function set(patch: Partial<PlaybackState>): void { state = { ...state, ...patch }; emit() }

export function getPlayback(): PlaybackState { return state }
export function subscribe(fn: () => void): () => void {
  listeners.add(fn); return () => listeners.delete(fn)
}

// 连读编排器（useContinuousReading）注册的彻底停止入口。
// store 只有播放态，作废不了编排器的 epoch/activeRef/在途合成：
// 关朗读开关时若只 stop()，正在等合成的连读循环不会感知，会继续往下读整本书，
// 而此时停止按钮已随开关一起隐藏 —— 用户没有任何手段叫停。
let readingStopper: (() => void) | null = null
export function setReadingStopper(fn: (() => void) | null): void {
  readingStopper = fn
}

export function setEnabled(v: boolean): void {
  try { localStorage.setItem(KEY_ENABLED, v ? '1' : '0') } catch {}
  if (!v) {
    if (readingStopper) readingStopper()
    else stop()
  }
  set({ enabled: v })
}
export function setReading(v: boolean): void { set({ reading: v }) }
export function setCurrentSeq(seq: number | null): void { set({ currentSeq: seq }) }

// 结束连读但保留 status/error：播放失败时用。stopReading() 会把 status 打回 idle，
// 连带抹掉刚写的报错，用户只看到朗读无声停下且没有原因。
export function endReading(): void {
  set({ reading: false, currentSeq: null })
}

// 停当前播放：pause + abort 合成 + revoke URL + resolve 'stopped' 让连读编排感知。
export function stop(): void {
  curAbort?.abort(); curAbort = null
  if (curAudio) { curAudio.pause(); curAudio = null }
  if (curUrl) { URL.revokeObjectURL(curUrl); curUrl = null }
  const resolve = curPlayResolve; curPlayResolve = null
  resolve?.('stopped')
  if (state.status !== 'idle') set({ status: 'idle' })
}

// 停连读（stop + 清连读态）。
export function stopReading(): void {
  stop()
  set({ reading: false, currentSeq: null })
}

// 合成 → blob URL（连读预取缓存用；调用方负责 revokeObjectURL）。
export async function synthesizeToUrl(
  profile: VoiceProfile,
  text: string,
  signal?: AbortSignal
): Promise<string> {
  const wav = await synthesize(profile, text, signal)
  return URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }))
}

// 播已合成的 URL，await 播完；返 'done'（正常播完）/'stopped'（被 stop 打断）/'error'（放不出来）。
// 抢占：先 stop 旧的。
export function playUrl(url: string): Promise<PlayResult> {
  stop()
  return new Promise((resolve) => {
    curPlayResolve = resolve
    const audio = new Audio(url)
    curAudio = audio
    // 只处理「自己仍是当前音频」的终态：被新播放抢占（curAudio 已换）后，
    // 旧音频的 ended/error 仍可能触发——若此时改 status/resolve，会把新播放的状态踩掉
    // （如新音频正在 playing 却被旧音频的 ended 打成 idle）。
    const isCurrent = (): boolean => curAudio === audio
    audio.onended = () => {
      if (!isCurrent()) return
      curAudio = null
      curPlayResolve = null
      set({ status: 'idle' })
      resolve('done')
    }
    audio.onerror = () => {
      if (!isCurrent()) return
      curAudio = null
      curPlayResolve = null
      // 到这步说明 blob 已生成但浏览器无法解码（合成侧已过 looksLikeAudio 门，通常是编解码/损坏）。
      set({ status: 'error', error: '音频无法播放：返回的数据不是有效音频（检查 SoVITS 参考音频与模型）' })
      resolve('error')
    }
    audio.play().then(() => set({ status: 'playing' })).catch((e) => {
      if (!isCurrent()) return
      curAudio = null
      curPlayResolve = null
      set({ status: 'error', error: e instanceof Error ? e.message : String(e) })
      resolve('error')
    })
  })
}

// 单段点击即播（合成+播，左键读词/右键读段，抢占语义）。
export async function playSingle(profile: VoiceProfile | null, text: string): Promise<void> {
  stop()
  if (!profile) { set({ status: 'error', error: '未配置声音档案（设置→声音）' }); return }
  if (!text?.trim()) return
  const ac = new AbortController(); curAbort = ac
  set({ status: 'loading', error: undefined })
  try {
    const url = await synthesizeToUrl(profile, text, ac.signal)
    if (ac.signal.aborted) { URL.revokeObjectURL(url); return }
    curAbort = null
    // 注意：不能提前 curUrl=url —— playUrl 第一行 stop() 会 revoke curUrl，把刚要播的 url 吊销
    // → new Audio 拿到死 blob → "no supported source"。改为播完（done/stopped）再 revoke（同连读）。
    await playUrl(url)
    URL.revokeObjectURL(url)
  } catch (e) {
    if (ac.signal.aborted) return
    set({ status: 'error', error: e instanceof Error ? e.message : String(e) })
  }
}

export function usePlayback(): PlaybackState {
  return useSyncExternalStore(subscribe, getPlayback, getPlayback)
}
