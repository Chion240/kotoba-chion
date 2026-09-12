// storage · 模块入口：组装 SQLite + 进度，注册契约 4 的数据相关 IPC。
import { ipcMain, app } from 'electron'
import { join } from 'path'
import { openDb, type StorageDb } from './db'
import { openProgress, type ProgressStore } from './progress'
import { IPC_CHANNELS } from '../../../shared/ipc'

export type { Segment, SegmentInput, StorageDb, BookMeta, ChapterMeta } from './db'
export type { Progress } from './progress'
export { openDb } from './db'
export { openProgress } from './progress'

export type Storage = { db: StorageDb; progress: ProgressStore }

// 生产装配：库落 userData/chion.db，进度走 electron-store 默认目录。
export function createStorage(): Storage {
  const db = openDb(join(app.getPath('userData'), 'chion.db'))
  const progress = openProgress()
  return { db, progress }
}

// 契约 4 里 storage 负责的四个通道（importBook / getImagePath 归 epub-import）。
export function registerStorageIpc(storage: Storage): void {
  const { db, progress } = storage
  ipcMain.handle(IPC_CHANNELS.storage.getSegments, (_e, bookId: number, seqFrom: number, seqTo: number) =>
    db.getSegments(bookId, seqFrom, seqTo)
  )
  ipcMain.handle(IPC_CHANNELS.storage.saveAiTranslation, (_e, segId: number, zh: string) =>
    db.saveAiTranslation(segId, zh)
  )
  ipcMain.handle(IPC_CHANNELS.storage.saveProgress, (_e, bookId: number, seq: number) =>
    progress.saveProgress(bookId, seq)
  )
  ipcMain.handle(IPC_CHANNELS.storage.getProgress, (_e, bookId: number) => progress.getProgress(bookId))
  // 契约 4 扩展（CR-1）：书架列表。删书（deleteBook）需清图片目录，走 main 编排（见 main/index.ts）。
  ipcMain.handle(IPC_CHANNELS.storage.listBooks, () => db.listBooks())
  // 契约 4 扩展（CR-2）：列章节（含起止 seq），供目录跳转 + 按章加载。
  ipcMain.handle(IPC_CHANNELS.storage.listChapters, (_e, bookId: number) => db.listChapters(bookId))
}
