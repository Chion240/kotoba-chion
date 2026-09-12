import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron'
import { join } from 'path'
import { mkdirSync, rmSync } from 'fs'
import { fileURLToPath } from 'url'
import { createStorage, registerStorageIpc, type Storage } from './modules/storage'
import { registerImportIpc } from './modules/epub-import'
import { openAiStore, registerAiStoreIpc } from './modules/ai-store'
import { createFontStore, registerFontStoreIpc } from './modules/font-store'
import { openVoiceStore, registerVoiceStoreIpc } from './modules/voice-store'
import {
  openDictionaryApp,
  openIntegrationStore,
  registerIntegrationIpc
} from './modules/integration-store'
import { IPC_CHANNELS } from '../shared/ipc'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const APP_ID = 'com.chion240.kotobachion'
const USER_DATA_DIR_NAME = 'kotoba-chion'

// productName 用于用户可见名称；数据目录保持旧版的 kotoba-chion，避免发行版“丢失”
// 开发期已经导入的书库和设置。安装版与免安装版也因此天然共享同一份数据。
const stableUserDataPath = join(app.getPath('appData'), USER_DATA_DIR_NAME)
mkdirSync(stableUserDataPath, { recursive: true })
app.setPath('userData', stableUserDataPath)
if (process.platform === 'win32') app.setAppUserModelId(APP_ID)

// SQLite/进度/设置都是单机单写者模型；阻止双开可避免两个主进程同时操作同一 userData。
const isPrimaryInstance = app.requestSingleInstanceLock()

// will-quit 关库用（whenReady 里赋值）。
let storageRef: Storage | null = null

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true, // 隐藏原生菜单栏（配合 setApplicationMenu(null)，Alt 也不召出）
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })
  win.removeMenu() // 彻底移除本窗口菜单（Windows 上比全局 setApplicationMenu 更保险）

  // 子窗口继承 preload（整套 chion API 暴露给被打开的页面），故一律拒绝新窗口，
  // 外链交给系统浏览器；同理禁止主窗口导航离开应用自身（AI 回答里的链接点不炸本窗）。
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    const current = win.webContents.getURL()
    if (url !== current) {
      e.preventDefault()
      if (/^https?:/i.test(url)) shell.openExternal(url)
    }
  })

  win.on('ready-to-show', () => win.show())

  // 开发用 dev server，生产读打包后的 index.html
  if (process.env['ELECTRON_RENDERER_URL']) {
    // dev：自动开 detach 控制台（用户 F12 叫不出，诊断前提），并把渲染层 console 转发到主进程 stdout。
    win.webContents.openDevTools({ mode: 'detach' })
    win.webContents.on('console-message', (...args: unknown[]) => {
      // Electron 版本间签名不一：老版 (event, level, message, …)，新版 (event{message,level})。
      const a = args as [{ message?: string }, unknown, string?]
      const message = a[0]?.message ?? a[2] ?? ''
      if (typeof message === 'string' && message.includes('[tokenizer]')) console.log(message)
    })
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// 契约 4 扩展（CR-1）：删书 + 文件选择器。编排在 composition root，不侵入 storage/epub-import 模块。
// 删书清三处（会话 2/4 下游须知）：db 两库（storage）+ 进度（electron-store）+ 图片目录 <userData>/books/<bookId>/。
function registerLibraryIpc(storage: Storage): void {
  const booksRoot = join(app.getPath('userData'), 'books')

  ipcMain.handle(IPC_CHANNELS.storage.deleteBook, (_e, bookId: number): void => {
    // IPC 不校验类型：bookId 若是 "../.." 之类，下面 rmSync(recursive) 会删到 userData 之外。
    if (!Number.isInteger(bookId) || bookId <= 0) throw new Error(`非法 bookId：${String(bookId)}`)
    storage.db.deleteBook(bookId)
    storage.progress.deleteProgress(bookId)
    rmSync(join(booksRoot, String(bookId)), { recursive: true, force: true })
  })

  // dialog.showOpenDialog 选单个 epub；用户取消返 null（渲染层据此不导入）。
  ipcMain.handle(IPC_CHANNELS.dialog.pickEpub, async (): Promise<string | null> => {
    const r = await dialog.showOpenDialog({
      title: '选择 EPUB 文件',
      properties: ['openFile'],
      filters: [{ name: 'EPUB', extensions: ['epub'] }]
    })
    return r.canceled || r.filePaths.length === 0 ? null : r.filePaths[0]
  })
}

if (!isPrimaryInstance) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })

  void app.whenReady()
    .then(() => {
      // 隐藏原生菜单栏（File/Edit/View/Window/Help）——纯阅读器无需系统菜单。dev 的 devtools 仍由 openDevTools 显式开。
      Menu.setApplicationMenu(null)
      const storage = createStorage()
      storageRef = storage
      registerStorageIpc(storage)
      registerImportIpc(storage.db)
      registerLibraryIpc(storage)
      // ai-analysis（会话 10）：AI 档案 + 对话存档持久化（CR-3）。renderer 直连 DeepSeek 不经 IPC。
      registerAiStoreIpc(openAiStore())
      // settings（会话 12）：自定义字体导入/落盘（CR-4）。
      registerFontStoreIpc(createFontStore())
      // tts（会话 17）：声音档案持久化 + 参考音频选择器（CR-5）。合成走渲染层直连 localhost:9880。
      registerVoiceStoreIpc(openVoiceStore())
      const integrationStore = openIntegrationStore()
      registerIntegrationIpc(integrationStore)
      const integration = integrationStore.getSettings()
      if (integration.autoLaunchDictionaryApp && integration.dictionaryAppPath) {
        void openDictionaryApp(integration.dictionaryAppPath).then((error) => {
          const current = integrationStore.getSettings()
          if (
            current.autoLaunchDictionaryApp &&
            current.dictionaryAppPath === integration.dictionaryAppPath
          ) {
            integrationStore.setLastLaunchError(error)
          }
          if (error) console.warn(`[integration] 查词软件启动失败：${error}`)
        })
      } else {
        integrationStore.setLastLaunchError('')
      }
      createWindow()
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
      })
    })
    .catch((e: unknown) => {
      // 启动期抛错（典型：chion.db 损坏 → new Database/exec(SCHEMA) 抛）若不接，
      // 进程会静默留在后台且永不建窗——用户只看到「点了没反应」。
      dialog.showErrorBox('启动失败', e instanceof Error ? e.stack || e.message : String(e))
      app.quit()
    })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// 退出前显式关库：WAL 模式下不关会留 -wal/-shm 未合并（正常也能恢复，但干净收尾更稳）。
app.on('will-quit', () => {
  storageRef?.db.close()
})
