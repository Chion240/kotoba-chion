// ai-store · 模块入口：两个 electron-store（ai-profiles / chat-archive），可注入 cwd（仿 progress.ts）。
// CR-3：renderer 直连 DeepSeek 走 SSE 不经此；此模块只管 AI 档案 + 对话存档的跨进程持久化。
import Store from 'electron-store'
import { ipcMain } from 'electron'
import { appendRound, type ChatRound, type ChatArchiveDay } from './logical-day'
import { IPC_CHANNELS } from '../../../shared/ipc'
import type { AiProfile, AiProfilesState } from '../../../shared/contracts'

export type { ChatRound, ChatArchiveDay } from './logical-day'
export type { AiProfile, AiProfilesState } from '../../../shared/contracts'
export { logicalDay, appendRound } from './logical-day'

// CR-3 类型（AI 档案，含 apiKey 明文存，决策已定）。
type ProfilesSchema = { state: AiProfilesState }
type ArchiveSchema = { days: ChatArchiveDay[] }

const EMPTY_PROFILES: AiProfilesState = { profiles: [], activeId: '' }

// cwd 可注入 —— 生产用默认 userData，自测传临时目录（不依赖 electron app）。
export function openAiStore(cwd?: string) {
  const profilesStore = new Store<ProfilesSchema>({
    name: 'ai-profiles',
    defaults: { state: EMPTY_PROFILES },
    ...(cwd ? { cwd } : {})
  })
  const archiveStore = new Store<ArchiveSchema>({
    name: 'chat-archive',
    defaults: { days: [] },
    ...(cwd ? { cwd } : {})
  })

  return {
    getProfiles(): AiProfilesState {
      return profilesStore.get('state')
    },
    // 整体覆盖写：档案增删改切都走这条（CR-3）。
    saveProfiles(state: AiProfilesState): void {
      profilesStore.set('state', state)
    },
    // 每轮 done 追加：主进程按逻辑日合并同日（CONTEXT「对话存档」）。
    appendChatArchive(round: ChatRound): void {
      archiveStore.set('days', appendRound(archiveStore.get('days'), round))
    },
    listChatArchive(): ChatArchiveDay[] {
      return archiveStore.get('days')
    }
  }
}

export type AiStore = ReturnType<typeof openAiStore>

// CR-3 的 4 个通道。renderer 直连 DeepSeek 不经 IPC；此处只持久化档案 + 存档。
export function registerAiStoreIpc(store: AiStore): void {
  ipcMain.handle(IPC_CHANNELS.ai.getProfiles, () => store.getProfiles())
  ipcMain.handle(IPC_CHANNELS.ai.saveProfiles, (_e, state: AiProfilesState) => store.saveProfiles(state))
  ipcMain.handle(IPC_CHANNELS.ai.appendChatArchive, (_e, round: ChatRound) => store.appendChatArchive(round))
  ipcMain.handle(IPC_CHANNELS.ai.listChatArchive, () => store.listChatArchive())
}
