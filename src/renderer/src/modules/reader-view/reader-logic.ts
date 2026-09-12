// reader-view 纯逻辑（无 DOM/electron，供自测独立跑 —— 铁律 4）。
// 会话 9.1：t 键悬停切译文的集合运算 + 面板拖宽的宽度夹取。

// t 键：切换「悬停段」的译文展开态。
//   hoveredSeq 为 null（鼠标不在任何段上）→ 原样返回，不响应（用户明确要求，防误触）。
//   命中 → 翻转该 seq 在展开集合里的存在。
export function toggleHoveredZh(open: Set<number>, hoveredSeq: number | null): Set<number> {
  if (hoveredSeq === null) return open
  const next = new Set(open)
  next.has(hoveredSeq) ? next.delete(hoveredSeq) : next.add(hoveredSeq)
  return next
}

// 面板拖宽：把像素宽夹进 [min,max]（防拖没/拖爆布局）。
export function clampWidth(px: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, px))
}

// 词框横向间距（会话 11）：滑块调「分词后两组词之间的距离」，单位 em。
// 合理范围 [0, 0.5]em；NaN/非数（localStorage 脏值）兜底默认 0.02em（原写死值）。
export const TOKEN_GAP_DEFAULT = 0.02
export const TOKEN_GAP_MIN = 0
export const TOKEN_GAP_MAX = 0.5
export function clampTokenGap(em: number): number {
  if (!Number.isFinite(em)) return TOKEN_GAP_DEFAULT
  return Math.max(TOKEN_GAP_MIN, Math.min(TOKEN_GAP_MAX, em))
}

// 词框底色（会话 11.1）：淡色框住每个词，颜色 + 透明度可调（弃黑边）。
// 颜色是 #rrggbb（<input type=color> 产物），透明度 [0,1]。CSS 用 color-mix 混透明。
export const TOKEN_BG_COLOR_DEFAULT = '#6b8cae'
export const TOKEN_BG_OPACITY_DEFAULT = 0.18
export function clampOpacity(v: number): number {
  if (!Number.isFinite(v)) return TOKEN_BG_OPACITY_DEFAULT
  return Math.max(0, Math.min(1, v))
}
// 脏 localStorage 兜底：非 #rgb/#rrggbb 十六进制 → 默认色。
export function sanitizeHexColor(c: string | null): string {
  return c && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c) ? c : TOKEN_BG_COLOR_DEFAULT
}
