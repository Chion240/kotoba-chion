// settings · 字体注册（渲染层）：导入的字体落主进程磁盘（CR-4），此处用 @font-face 动态注册进文档，
// 使字体族下拉出现该字体、正文/译文槽可选它。file://<path> 加载本地字体文件。
import { useCallback, useEffect, useState } from 'react'
import type { FontMeta } from '../../../../shared/contracts'

const STYLE_ID = 'chion-imported-fonts'

// 把一组字体元数据写成 <style> 里的 @font-face 规则（family 名 = FontMeta.family）。
// path 里的反斜杠转正斜杠、单引号剔除，避免 url() 语法破坏（family 名已由主进程取自文件名，安全）。
function renderFontFaces(fonts: FontMeta[]): string {
  return fonts
    .map((f) => {
      const url = 'file://' + f.path.replace(/\\/g, '/').replace(/'/g, '')
      const fam = f.family.replace(/["'\\]/g, '')
      return `@font-face { font-family: '${fam}'; src: url('${url}'); font-display: swap; }`
    })
    .join('\n')
}

function injectFontFaces(fonts: FontMeta[]): void {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  el.textContent = renderFontFaces(fonts)
}

// 已导入字体清单 + 导入/删除；每次变动重刷 @font-face。
export function useFonts(): {
  fonts: FontMeta[]
  importFont: () => Promise<void>
  deleteFont: (id: string) => Promise<void>
} {
  const [fonts, setFonts] = useState<FontMeta[]>([])

  const refresh = useCallback(async () => {
    const list = await window.chion.listFonts()
    injectFontFaces(list)
    setFonts(list)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const importFont = useCallback(async () => {
    const meta = await window.chion.importFont()
    if (meta) await refresh()
  }, [refresh])

  const deleteFont = useCallback(
    async (id: string) => {
      await window.chion.deleteFont(id)
      await refresh()
    },
    [refresh]
  )

  return { fonts, importFont, deleteFont }
}

export { renderFontFaces }
