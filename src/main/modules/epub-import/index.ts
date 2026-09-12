// epub-import · 模块入口：注册契约 4 里本模块负责的两通道（importBook / getImagePath）。
import { ipcMain, app } from 'electron'
import { join, resolve, isAbsolute, relative } from 'path'
import { readFileSync } from 'node:fs'
import { importBook, imageDir, type ImportDeps, type ImportResult } from './import'
import type { StorageDb } from '../storage/db'
import { IPC_CHANNELS } from '../../../shared/ipc'

export { importBook, imageDir } from './import'
export type { ImportResult, ImportDeps } from './import'

// 生产装配：图片落 userData/books，入库走已建好的 storage db。
export function registerImportIpc(db: StorageDb): void {
  const booksRoot = join(app.getPath('userData'), 'books')
  const deps: ImportDeps = { db, booksRoot }

  // 契约 4：importBook(path, mode) —— 用户手选 mode（决策 6）。
  ipcMain.handle(
    IPC_CHANNELS.epub.importBook,
    (_e, path: unknown, mode: unknown): ImportResult => {
      if (typeof path !== 'string' || path.trim() === '') {
        throw new Error('EPUB 路径无效')
      }
      if (mode !== 'bilingual' && mode !== 'jp') {
        throw new Error('导入模式无效')
      }
      return importBook(path, mode, deps)
    }
  )

  // 契约 4：getImagePath —— image_ref（相对 booksRoot）读盘转 data URL 喂 <img>。
  // 不用 file:// 绝对路径：Windows 格式坑（file://C:\ 把 C: 当主机）+ dev 下 http 源禁加载 file://。
  // data URL 无源限制、生产同样通。读盘失败返空串，渲染层保持 placeholder。
  ipcMain.handle(IPC_CHANNELS.epub.getImagePath, (_e, imageRef: string): string => {
    try {
      const file = safeImagePath(booksRoot, imageRef)
      if (!file) return ''
      const buf = readFileSync(file)
      return `data:${mimeOf(imageRef)};base64,${buf.toString('base64')}`
    } catch {
      return ''
    }
  })
}

// image_ref 直接来自渲染层，未加约束时 "../../..." 或绝对路径能读走磁盘上任意文件
// 并以 data URL 交回渲染层。故解析后必须仍落在 booksRoot 内，否则拒绝。
export function safeImagePath(booksRoot: string, imageRef: unknown): string | null {
  if (typeof imageRef !== 'string' || imageRef === '') return null
  if (imageRef.includes('\0') || isAbsolute(imageRef)) return null
  const root = resolve(booksRoot)
  const file = resolve(root, imageRef)
  const rel = relative(root, file)
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return null
  return file
}

// 按扩展名定 MIME（兜底 image/jpeg）。
function mimeOf(ref: string): string {
  const ext = ref.slice(ref.lastIndexOf('.') + 1).toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'svg' || ext === 'svgz') return 'image/svg+xml'
  return 'image/jpeg'
}
