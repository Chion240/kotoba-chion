/**
 * Electron IPC channel names shared by the main process and preload bridge.
 *
 * Keeping channel identifiers in one place prevents silent drift between
 * `ipcMain.handle` registrations and `ipcRenderer.invoke` calls. The object
 * is intentionally data-only so it can be imported by both bundles without
 * pulling Electron or any platform-specific implementation into the shared
 * layer.
 */
export const IPC_CHANNELS = {
  storage: {
    getSegments: 'storage:getSegments',
    saveAiTranslation: 'storage:saveAiTranslation',
    saveProgress: 'storage:saveProgress',
    getProgress: 'storage:getProgress',
    listBooks: 'storage:listBooks',
    listChapters: 'storage:listChapters',
    deleteBook: 'storage:deleteBook'
  },
  epub: {
    importBook: 'epub:importBook',
    getImagePath: 'epub:getImagePath'
  },
  dialog: {
    pickEpub: 'dialog:pickEpub'
  },
  ai: {
    getProfiles: 'ai:getProfiles',
    saveProfiles: 'ai:saveProfiles',
    appendChatArchive: 'ai:appendChatArchive',
    listChatArchive: 'ai:listChatArchive'
  },
  font: {
    import: 'font:import',
    list: 'font:list',
    delete: 'font:delete'
  },
  voice: {
    getProfiles: 'voice:getProfiles',
    saveProfiles: 'voice:saveProfiles',
    pickAudioFile: 'voice:pickAudioFile',
    synthesize: 'voice:synthesize',
    cancelSynthesize: 'voice:cancelSynthesize'
  },
  integration: {
    getSettings: 'integration:getSettings',
    getLastLaunchError: 'integration:getLastLaunchError',
    saveSettings: 'integration:saveSettings',
    pickDictionaryApp: 'integration:pickDictionaryApp',
    launchDictionaryApp: 'integration:launchDictionaryApp'
  }
} as const

export type IpcChannel =
  | (typeof IPC_CHANNELS.storage)[keyof typeof IPC_CHANNELS.storage]
  | (typeof IPC_CHANNELS.epub)[keyof typeof IPC_CHANNELS.epub]
  | (typeof IPC_CHANNELS.dialog)[keyof typeof IPC_CHANNELS.dialog]
  | (typeof IPC_CHANNELS.ai)[keyof typeof IPC_CHANNELS.ai]
  | (typeof IPC_CHANNELS.font)[keyof typeof IPC_CHANNELS.font]
  | (typeof IPC_CHANNELS.voice)[keyof typeof IPC_CHANNELS.voice]
  | (typeof IPC_CHANNELS.integration)[keyof typeof IPC_CHANNELS.integration]
