// font-store · 主进程：自定义字体导入/落盘（CR-4）。仿 epub-import 图片落盘 + storage 可注入 cwd 模式。
// 字体文件（5–15MB）localStorage 装不下，故落磁盘 <userData>/fonts/；渲染层用 @font-face src:file://<path> 注册。
// 契约 4 仅新增三通道，不改既有（CR-4，总纲层预批准）。
import { app, dialog, ipcMain } from 'electron'
import { copyFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { IPC_CHANNELS } from '../../../shared/ipc'
import type { FontMeta } from '../../../shared/contracts'
export type { FontMeta } from '../../../shared/contracts'

// CR-4 类型（原样落地）。
const FONT_EXTS = ['ttf', 'otf', 'woff2', 'woff']

// cwd 可注入 —— 生产用默认 userData/fonts，自测传临时目录（不依赖 electron dialog）。
export function openFontStore(fontsDir: string) {
  function ensureDir(): void {
    mkdirSync(fontsDir, { recursive: true })
  }
  function metaOf(fileName: string): FontMeta {
    const id = basename(fileName, extname(fileName))
    return { id, family: id, fileName, path: join(fontsDir, fileName) }
  }

  return {
    fontsDir,
    // 拷贝一个选中的字体文件到 fontsDir，返回落盘元数据（重名直接覆盖）。
    // 只收字体扩展名：dialog 的 filters 只是建议（用户可改 *.* 选任意文件），
    // 非字体文件拷进来既占盘又可能覆盖同名真字体，这里硬校验拦截。
    addFontFile(srcPath: string): FontMeta {
      const ext = extname(srcPath).slice(1).toLowerCase()
      if (!FONT_EXTS.includes(ext)) throw new Error(`不支持的字体格式：.${ext}（支持 ${FONT_EXTS.join('/')}）`)
      ensureDir()
      const fileName = basename(srcPath)
      copyFileSync(srcPath, join(fontsDir, fileName))
      return metaOf(fileName)
    },
    listFonts(): FontMeta[] {
      if (!existsSync(fontsDir)) return []
      return readdirSync(fontsDir)
        .filter((f) => FONT_EXTS.includes(extname(f).slice(1).toLowerCase()))
        .map(metaOf)
    },
    // 删除已导入字体：id = 文件名去扩展；扫目录匹配任一扩展删之。
    deleteFont(id: string): void {
      if (!existsSync(fontsDir)) return
      for (const f of readdirSync(fontsDir)) {
        if (basename(f, extname(f)) === id) rmSync(join(fontsDir, f), { force: true })
      }
    }
  }
}

export type FontStore = ReturnType<typeof openFontStore>

// 生产装配：字体落 <userData>/fonts。
export function createFontStore(): FontStore {
  return openFontStore(join(app.getPath('userData'), 'fonts'))
}

// CR-4 的三通道。importFont 走 dialog 选文件（取消返 null）+ 拷贝落盘。
export function registerFontStoreIpc(store: FontStore): void {
  ipcMain.handle(IPC_CHANNELS.font.import, async (): Promise<FontMeta | null> => {
    const r = await dialog.showOpenDialog({
      title: '选择字体文件',
      properties: ['openFile'],
      filters: [{ name: '字体', extensions: FONT_EXTS }]
    })
    if (r.canceled || r.filePaths.length === 0) return null
    return store.addFontFile(r.filePaths[0])
  })
  ipcMain.handle(IPC_CHANNELS.font.list, (): FontMeta[] => store.listFonts())
  ipcMain.handle(IPC_CHANNELS.font.delete, (_e, id: string): void => store.deleteFont(id))
}
