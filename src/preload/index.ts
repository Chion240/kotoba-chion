import { contextBridge, ipcRenderer } from 'electron'
import type { Segment, Progress, BookMeta, ChapterMeta } from '../shared/contracts'
import type { ImportResult } from '../shared/contracts'
import type {
  AiProfilesState,
  ChatRound,
  ChatArchiveDay
} from '../shared/contracts'
import type { FontMeta } from '../shared/contracts'
import type { VoiceProfilesState, TtsSynthesizeReq } from '../shared/contracts'
import type { IntegrationSettings } from '../shared/contracts'
import { IPC_CHANNELS } from '../shared/ipc'

// 契约 4（IPC）的门。storage 会话挂数据相关四通道；epub-import 会话续挂 importBook/getImagePath。
const api = {
  getSegments: (bookId: number, seqFrom: number, seqTo: number): Promise<Segment[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.storage.getSegments, bookId, seqFrom, seqTo),
  saveAiTranslation: (segId: number, zh: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.storage.saveAiTranslation, segId, zh),
  saveProgress: (bookId: number, seq: number): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.storage.saveProgress, bookId, seq),
  getProgress: (bookId: number): Promise<Progress | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.storage.getProgress, bookId),
  // epub-import 会话续挂：用户手选 mode（决策 6）。
  importBook: (path: string, mode: 'bilingual' | 'jp'): Promise<ImportResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.epub.importBook, path, mode),
  getImagePath: (imageRef: string): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.epub.getImagePath, imageRef),
  // 契约 4 扩展（CR-1，library 会话）：书架列表 / 删书 / 文件选择器。
  listBooks: (): Promise<BookMeta[]> => ipcRenderer.invoke(IPC_CHANNELS.storage.listBooks),
  // 契约 4 扩展（CR-2，reader-view 会话）：列章节（含起止 seq），供目录跳转 + 按章加载。
  listChapters: (bookId: number): Promise<ChapterMeta[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.storage.listChapters, bookId),
  deleteBook: (bookId: number): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.storage.deleteBook, bookId),
  pickEpubFile: (): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.dialog.pickEpub),
  // 契约 4 扩展（CR-3，ai-analysis 会话）：AI 档案 + 对话存档持久化。
  // renderer 直连 DeepSeek（SSE）不经 IPC；只这两类持久化跨进程。
  getAiProfiles: (): Promise<AiProfilesState> => ipcRenderer.invoke(IPC_CHANNELS.ai.getProfiles),
  saveAiProfiles: (state: AiProfilesState): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.ai.saveProfiles, state),
  appendChatArchive: (round: ChatRound): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.ai.appendChatArchive, round),
  listChatArchive: (): Promise<ChatArchiveDay[]> => ipcRenderer.invoke(IPC_CHANNELS.ai.listChatArchive),
  // 契约 4 扩展（CR-4，settings 会话）：自定义字体导入/落盘。字体文件落主进程磁盘（大文件）。
  importFont: (): Promise<FontMeta | null> => ipcRenderer.invoke(IPC_CHANNELS.font.import),
  listFonts: (): Promise<FontMeta[]> => ipcRenderer.invoke(IPC_CHANNELS.font.list),
  deleteFont: (id: string): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.font.delete, id),
  // 契约 4 扩展（CR-5，tts 会话）：声音档案持久化 + 参考音频文件选择器。
  // 合成不经 IPC（渲染层直连 localhost:9880 拿 wav）；只这两类 + 选文件跨进程。
  getVoiceProfiles: (): Promise<VoiceProfilesState> => ipcRenderer.invoke(IPC_CHANNELS.voice.getProfiles),
  saveVoiceProfiles: (state: VoiceProfilesState): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.voice.saveProfiles, state),
  pickAudioFile: (): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.voice.pickAudioFile),
  // 合成代发（绕浏览器 CORS）：渲染层组装请求，主进程 Node fetch 拿 wav 字节。
  // reqId 让渲染层的 AbortSignal 能真正传到主进程 fetch —— 否则中断只丢弃结果，
  // SoVITS 仍在串行队列里合成那段废稿，跳转后的新段要排在它后面。
  ttsSynthesize: (req: TtsSynthesizeReq, reqId?: string): Promise<Uint8Array> =>
    ipcRenderer.invoke(IPC_CHANNELS.voice.synthesize, req, reqId),
  ttsCancel: (reqId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.voice.cancelSynthesize, reqId),
  getIntegrationSettings: (): Promise<IntegrationSettings> =>
    ipcRenderer.invoke(IPC_CHANNELS.integration.getSettings),
  getDictionaryLaunchError: (): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.integration.getLastLaunchError),
  saveIntegrationSettings: (settings: IntegrationSettings): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.integration.saveSettings, settings),
  pickDictionaryApp: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.integration.pickDictionaryApp),
  launchDictionaryApp: (path: string): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.integration.launchDictionaryApp, path)
}

contextBridge.exposeInMainWorld('chion', api)

export type ChionApi = typeof api
