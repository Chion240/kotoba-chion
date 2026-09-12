// 写剪贴板喂外部 GoldenDict（总纲第 1、5 节）。渲染层 API 即可——
// Electron 渲染进程有完整 navigator.clipboard；退路用 execCommend 兜底。
// 所有选择都写剪贴板（不受草稿保护限制，草稿保护只管 AI 输入框）。
export async function writeClipboard(text: string): Promise<void> {
  if (!text) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
  } catch {
    // 失焦/权限等异常 → 落到退路
  }
  legacyCopy(text)
}

// 退路：临时 textarea + execCommand（老接口，仍在 Electron 渲染层可用）。
function legacyCopy(text: string): void {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  try {
    document.execCommand('copy')
  } finally {
    document.body.removeChild(ta)
  }
}
