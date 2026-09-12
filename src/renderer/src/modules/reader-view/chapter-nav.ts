// 章节导航纯逻辑（无 DOM/electron，供自测独立跑 —— 铁律 4）。
// 目录标题占位（决策 1：全列各章，空标题显示「插图/第N节」）+ 按 seq 反查所属章。
import type { ChapterMeta } from '../../../../shared/contracts'

// 目录显示名：有标题用标题；空标题按内容给占位。
//   纯图片章（起止段都无正文，无从判断）→「插图」；否则「第 N 节」（N=列表位次，从 1 起）。
// idx 是章在 listChapters 结果里的位次（0 基）；isImageOnly 由渲染层按该章段判断，缺省 false。
export function chapterLabel(ch: ChapterMeta, idx: number, isImageOnly = false): string {
  const t = ch.title.trim()
  if (t) return t
  return isImageOnly ? '插图' : `第 ${idx + 1} 节`
}

// 按全局 seq 找它落在哪一章（返回章在数组里的位次；找不到返回 -1）。
// chapters 已按 startSeq 升序（db listChapters ORDER BY startSeq）。
export function findChapterIndex(chapters: ChapterMeta[], seq: number): number {
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i]
    if (seq >= c.startSeq && seq <= c.endSeq) return i
  }
  // 落在章间隙（理论上不该有，段连续）→ 兜底最近的前一章；都不在则第 0 章。
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (seq >= chapters[i].startSeq) return i
  }
  return chapters.length ? 0 : -1
}
