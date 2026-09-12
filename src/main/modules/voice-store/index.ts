// voice-store · 主进程：声音档案持久化（CR-5）+ 参考音频文件选择器。仿 ai-store 可注入 cwd 模式。
// 合成不走 IPC——渲染层直连 localhost:9880 拿 wav（同 ai-client 直连 SSE）。此模块只管档案 + 选文件。
// 参考音频对本地 SoVITS 是「服务端可达绝对路径」字符串，只传字符串不上传文件。
import Store from 'electron-store'
import { dialog, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../../shared/ipc'
import type { TtsSynthesizeReq, VoiceProfile, VoiceProfilesState } from '../../../shared/contracts'
export type { TtsSynthesizeReq, VoiceProfile, VoiceProfilesState } from '../../../shared/contracts'

// CR-5 类型（声音档案，对标 AI 档案）。apiKey 明文存（同 AI，全局一致）。
// 本地引擎 sovits：ref_audio_path/prompt_text 等；云端 openai（Phase 3）：apiKey/voice。
// 合成请求（渲染层组装 url/headers/body，主进程 Node fetch 代发——绕过浏览器 CORS）。
// 渲染层直连 localhost:9880 会触发 CORS 预检(OPTIONS)，SoVITS api_v2 不实现 OPTIONS → 405 被拦。
// Node 侧 fetch 无 CORS 限制，故合成走这条 IPC；文本规整仍在渲染层 synthesize 入口（单点根治）。
type Schema = { state: VoiceProfilesState }
const EMPTY: VoiceProfilesState = { profiles: [], activeId: '' }

// 一段话的合成在 CPU 上可能要几十秒，故给得宽；只为兜住「服务挂起不响应」。
const SYNTHESIZE_TIMEOUT_MS = 120_000

// 是否像音频字节（按 magic bytes 粗判，防把 JSON 错误当 wav）。
// wav=RIFF....WAVE、mp3=ID3 或 0xFFFB、ogg=OggS、flac=fLaC。
export function looksLikeAudio(b: Uint8Array): boolean {
  if (b.length < 12) return false
  const tag = (o: number, s: string): boolean =>
    [...s].every((c, i) => b[o + i] === c.charCodeAt(0))
  if (tag(0, 'RIFF') && tag(8, 'WAVE')) return true // wav
  if (tag(0, 'OggS')) return true // ogg
  if (tag(0, 'fLaC')) return true // flac
  if (tag(0, 'ID3')) return true // mp3 with id3
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return true // mp3 frame sync
  return false
}

// cwd 可注入 —— 生产用默认 userData，自测传临时目录（不依赖 electron app）。
export function openVoiceStore(cwd?: string) {
  const store = new Store<Schema>({
    name: 'voice-profiles',
    defaults: { state: EMPTY },
    ...(cwd ? { cwd } : {})
  })
  return {
    getProfiles(): VoiceProfilesState {
      return store.get('state')
    },
    // 整体覆盖写：档案增删改切都走这条（CR-5）。
    saveProfiles(state: VoiceProfilesState): void {
      store.set('state', state)
    }
  }
}

export type VoiceStore = ReturnType<typeof openVoiceStore>

// CR-5 的 3 通道。合成不经 IPC；此处只持久化档案 + 选参考音频文件（返服务端可达绝对路径）。
export function registerVoiceStoreIpc(store: VoiceStore): void {
  ipcMain.handle(IPC_CHANNELS.voice.getProfiles, () => store.getProfiles())
  ipcMain.handle(IPC_CHANNELS.voice.saveProfiles, (_e, state: VoiceProfilesState) => store.saveProfiles(state))

  // 在途合成：reqId → 中断器。渲染层 abort 时通过 voice:cancelSynthesize 真正掐断 fetch，
  // 让 SoVITS 尽快腾出串行队列（只在渲染层丢弃结果的话，废稿仍占着队列）。
  const inFlight = new Map<string, AbortController>()
  ipcMain.handle(IPC_CHANNELS.voice.cancelSynthesize, (_e, reqId: string) => {
    if (typeof reqId === 'string') inFlight.get(reqId)?.abort()
  })

  // 合成代发（绕 CORS）：Node fetch 打 TTS 服务，返 wav 字节（Uint8Array 过 IPC 结构化克隆）。
  ipcMain.handle(
    IPC_CHANNELS.voice.synthesize,
    async (_e, req: TtsSynthesizeReq, reqId?: string): Promise<Uint8Array> => {
      // SoVITS 加载模型/显卡占用时会挂着不响应而非报错；无超时则 invoke 永不 settle，
      // 播放状态卡在 loading 直到重启应用。
      const ac = new AbortController()
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        ac.abort()
      }, SYNTHESIZE_TIMEOUT_MS)
      if (typeof reqId === 'string' && reqId) inFlight.set(reqId, ac)
      let res: Response
      try {
        res = await fetch(req.url, {
          method: 'POST',
          headers: req.headers,
          body: JSON.stringify(req.body),
          signal: ac.signal
        })
      } catch (e) {
        if (timedOut) {
          throw new Error(
            `TTS 合成超时（${SYNTHESIZE_TIMEOUT_MS / 1000}s 无响应）：检查 ${req.url} 是否在运行、模型是否还在加载`
          )
        }
        if (ac.signal.aborted) throw new Error('已取消')
        throw new Error(`TTS 服务连接失败：${e instanceof Error ? e.message : String(e)}`)
      } finally {
        clearTimeout(timer)
        if (typeof reqId === 'string' && reqId) inFlight.delete(reqId)
      }
      const buf = await res.arrayBuffer()
      const bytes = new Uint8Array(buf)
      // SoVITS 失败时常返 200 + JSON（如 ref_audio_path 不存在/参数错），或 4xx + JSON。
      // 若不是音频字节，读成文本抛出真实原因——否则渲染层只会得到无法解码的 blob（"no supported source"）。
      if (!res.ok || !looksLikeAudio(bytes)) {
        const msg = new TextDecoder().decode(bytes).slice(0, 300).trim()
        throw new Error(
          `TTS 合成失败 (${res.status})${msg ? ': ' + msg : '：服务返回了非音频数据（检查参考音频路径是否存在、SoVITS 是否报错）'}`
        )
      }
      return bytes
    }
  )
  // 选参考音频：返回绝对路径字符串（SoVITS 服务端自己读盘），取消返 null。
  ipcMain.handle(IPC_CHANNELS.voice.pickAudioFile, async (): Promise<string | null> => {
    const r = await dialog.showOpenDialog({
      title: '选择参考音频',
      properties: ['openFile'],
      filters: [{ name: '音频', extensions: ['wav', 'mp3', 'flac', 'ogg', 'm4a'] }]
    })
    return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0]
  })
}
