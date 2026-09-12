// settings 纯逻辑（无 DOM/electron，供 test:settings 独立跑 —— 铁律 4）。
// 每个数值旋钮有 clamp（脏值/NaN 兜底默认）；颜色 sanitize（防非法值）；字体族名合法化（防 CSS 注入）；
// coerceSettings 把任意（缺字段/脏）JSON 补齐成合法 Settings（向前兼容，加旋钮不炸旧数据）。

// 数值旋钮的范围 + 默认（default/min/max）。单位见注释。
export const RANGES = {
  tokenGap: { def: 0.02, min: 0, max: 0.5 }, // em 词间距
  tokenLetterSpacing: { def: 0, min: 0, max: 0.3 }, // em 词框内字距
  tokenBgOpacity: { def: 0.18, min: 0, max: 1 }, // 词框底色透明度
  bodySize: { def: 1.2, min: 0.8, max: 2.4 }, // rem 正文字号
  lineHeight: { def: 2, min: 1.2, max: 3 }, // 无单位 行距
  leftMargin: { def: 8, min: 0, max: 100 }, // % 正文左边距
  rightMargin: { def: 8, min: 0, max: 100 }, // % 正文右边距
  segGap: { def: 0.35, min: 0, max: 3 }, // rem 段间距（.reader-pair 上下 margin，段与段之间的竖向空隙）
  headingSize: { def: 1.5, min: 1, max: 3 }, // rem 标题字号
  zhSize: { def: 1, min: 0.7, max: 2 }, // rem 译文字号
  zhWeight: { def: 400, min: 300, max: 700 }, // 译文字重
  zhOpacity: { def: 1, min: 0.2, max: 1 }, // 译文透明度
  furiganaSize: { def: 0.5, min: 0.3, max: 1 }, // em rt 大小
  furiganaOpacity: { def: 1, min: 0, max: 1 }, // rt 透明度
  tocFontSize: { def: 0.85, min: 0.6, max: 1.4 }, // rem 目录字号
  aiFontSize: { def: 0.9, min: 0.7, max: 1.6 }, // rem AI 面板字号
  fontWeight: { def: 400, min: 300, max: 700 }, // 字重
  verticalBodySize: { def: 1.2, min: 0.8, max: 2.4 }, // rem 竖排字号
  verticalLineHeight: { def: 2, min: 1.2, max: 3 }, // 竖排列高（em）
  verticalColumnGap: { def: 2.5, min: 0.5, max: 8 }, // rem 列间距
  verticalTopMargin: { def: 6, min: 0, max: 30 }, // % 顶边距
  verticalBottomMargin: { def: 6, min: 0, max: 30 }, // % 底边距
  verticalTokenGap: { def: 0.02, min: 0, max: 0.5 }, // em 竖排词间距
  verticalTokenLetterSpacing: { def: 0, min: 0, max: 0.3 } // em 竖排字距
} as const

export type NumericKnob = keyof typeof RANGES

// 通用夹取：NaN/非数（localStorage 脏值）→ 兜底默认；否则夹进 [min,max]。
export function clampKnob(knob: NumericKnob, v: number): number {
  const r = RANGES[knob]
  if (!Number.isFinite(v)) return r.def
  return Math.max(r.min, Math.min(r.max, v))
}

// 颜色默认（词框底色是唯一有具体默认的；正文/假名色空=跟随主题）。
export const TOKEN_BG_COLOR_DEFAULT = '#6b8cae'
// 合法 #rgb / #rrggbb 才留；空串合法（=跟随主题）；其他脏值 → 回落给定默认。
export function sanitizeColor(c: string | null | undefined, fallback: string): string {
  if (c === '') return ''
  return c && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c) ? c : fallback
}

// 字体族名合法化（防 CSS 注入）：剔除可能截断 CSS 值/注入声明的字符（; { } ( ) < > " ' \ 换行），
// 保留字母/数字/空格/连字符/下划线/逗号/CJK。空串合法（=跟随主题默认字体栈）。
export function sanitizeFontFamily(name: string | null | undefined): string {
  if (!name) return ''
  return name.replace(/[;{}()<>"'\\\r\n]/g, '').trim().slice(0, 120)
}

export type Mode = 'A' | 'B' | 'C'
export type Theme = 'light' | 'dark'
export const TOKEN_STYLES = [
  'capsule-soft',
  'capsule-clear',
  'capsule-minimal',
  'marker',
  'underline',
  'classic'
] as const
export type TokenStyle = (typeof TOKEN_STYLES)[number]

export type Settings = {
  // 数值旋钮
  tokenGap: number
  tokenLetterSpacing: number
  tokenBgOpacity: number
  bodySize: number
  lineHeight: number
  leftMargin: number
  rightMargin: number
  segGap: number
  headingSize: number
  zhSize: number
  zhWeight: number
  zhOpacity: number
  furiganaSize: number
  furiganaOpacity: number
  tocFontSize: number
  aiFontSize: number
  fontWeight: number
  verticalBodySize: number
  verticalLineHeight: number
  verticalColumnGap: number
  verticalTopMargin: number
  verticalBottomMargin: number
  verticalTokenGap: number
  verticalTokenLetterSpacing: number
  // 颜色（空=跟随主题）
  tokenBgColor: string
  bodyColor: string
  furiganaColor: string
  zhColor: string // 译文颜色（空=跟随主题 muted）
  bgColor: string // 阅读区背景
  panelBgColor: string // 目录 + AI 面板背景（同一旋钮）
  // 字体族（空=跟随主题默认栈）
  fontJp: string
  fontZh: string
  // 非 CSS 状态旋钮
  mode: Mode
  tokenStyle: TokenStyle
  furigana: boolean
  allZh: boolean
  theme: Theme
  layout: 'horizontal' | 'vertical'
}

export const DEFAULT_SETTINGS: Settings = {
  tokenGap: RANGES.tokenGap.def,
  tokenLetterSpacing: RANGES.tokenLetterSpacing.def,
  tokenBgOpacity: RANGES.tokenBgOpacity.def,
  bodySize: RANGES.bodySize.def,
  lineHeight: RANGES.lineHeight.def,
  leftMargin: RANGES.leftMargin.def,
  rightMargin: RANGES.rightMargin.def,
  segGap: RANGES.segGap.def,
  headingSize: RANGES.headingSize.def,
  zhSize: RANGES.zhSize.def,
  zhWeight: RANGES.zhWeight.def,
  zhOpacity: RANGES.zhOpacity.def,
  furiganaSize: RANGES.furiganaSize.def,
  furiganaOpacity: RANGES.furiganaOpacity.def,
  tocFontSize: RANGES.tocFontSize.def,
  aiFontSize: RANGES.aiFontSize.def,
  fontWeight: RANGES.fontWeight.def,
  verticalBodySize: RANGES.verticalBodySize.def,
  verticalLineHeight: RANGES.verticalLineHeight.def,
  verticalColumnGap: RANGES.verticalColumnGap.def,
  verticalTopMargin: RANGES.verticalTopMargin.def,
  verticalBottomMargin: RANGES.verticalBottomMargin.def,
  verticalTokenGap: RANGES.verticalTokenGap.def,
  verticalTokenLetterSpacing: RANGES.verticalTokenLetterSpacing.def,
  tokenBgColor: TOKEN_BG_COLOR_DEFAULT,
  bodyColor: '',
  furiganaColor: '',
  zhColor: '',
  bgColor: '',
  panelBgColor: '',
  fontJp: '',
  fontZh: '',
  mode: 'C',
  tokenStyle: 'capsule-soft',
  furigana: true,
  allZh: false,
  theme: 'light',
  layout: 'horizontal'
}

// 把任意（可能缺字段/脏）对象补齐成合法 Settings：缺的用默认，数值夹取，颜色/字体合法化，枚举校验。
// 向前兼容：加旋钮不炸旧 localStorage（缺字段自动补默认）。
export function coerceSettings(raw: unknown): Settings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const num = (k: NumericKnob): number => clampKnob(k, Number(o[k]))
  const legacyMargin = Number(o.margin)
  const margin = (k: 'leftMargin' | 'rightMargin'): number =>
    o[k] === undefined && Number.isFinite(legacyMargin)
      ? clampKnob(k, legacyMargin)
      : num(k)
  return {
    tokenGap: num('tokenGap'),
    tokenLetterSpacing: num('tokenLetterSpacing'),
    tokenBgOpacity: num('tokenBgOpacity'),
    bodySize: num('bodySize'),
    lineHeight: num('lineHeight'),
    leftMargin: margin('leftMargin'),
    rightMargin: margin('rightMargin'),
    segGap: num('segGap'),
    headingSize: num('headingSize'),
    zhSize: num('zhSize'),
    zhWeight: num('zhWeight'),
    zhOpacity: num('zhOpacity'),
    furiganaSize: num('furiganaSize'),
    furiganaOpacity: num('furiganaOpacity'),
    tocFontSize: num('tocFontSize'),
    aiFontSize: num('aiFontSize'),
    fontWeight: num('fontWeight'),
    verticalBodySize: num('verticalBodySize'),
    verticalLineHeight: num('verticalLineHeight'),
    verticalColumnGap: num('verticalColumnGap'),
    verticalTopMargin: num('verticalTopMargin'),
    verticalBottomMargin: num('verticalBottomMargin'),
    verticalTokenGap: num('verticalTokenGap'),
    verticalTokenLetterSpacing: num('verticalTokenLetterSpacing'),
    tokenBgColor: sanitizeColor(o.tokenBgColor as string, TOKEN_BG_COLOR_DEFAULT),
    bodyColor: sanitizeColor(o.bodyColor as string, ''),
    furiganaColor: sanitizeColor(o.furiganaColor as string, ''),
    zhColor: sanitizeColor(o.zhColor as string, ''),
    bgColor: sanitizeColor(o.bgColor as string, ''),
    panelBgColor: sanitizeColor(o.panelBgColor as string, ''),
    fontJp: sanitizeFontFamily(o.fontJp as string),
    fontZh: sanitizeFontFamily(o.fontZh as string),
    mode: o.mode === 'A' || o.mode === 'B' || o.mode === 'C' ? o.mode : 'C',
    tokenStyle: TOKEN_STYLES.includes(o.tokenStyle as TokenStyle)
      ? (o.tokenStyle as TokenStyle)
      : 'capsule-soft',
    furigana: typeof o.furigana === 'boolean' ? o.furigana : true,
    allZh: typeof o.allZh === 'boolean' ? o.allZh : false,
    theme: o.theme === 'dark' ? 'dark' : 'light',
    layout: o.layout === 'vertical' ? 'vertical' : 'horizontal'
  }
}

// 外观预设：一键套一组「明暗基底 + 背景/正文/面板色」。空色=跟随主题基底。
// 应用时 patch 进 settings（theme + 四个颜色槽），用户仍可在此之上微调单项。
export type AppearancePreset = {
  id: string
  label: string
  description: string
  patch: Pick<Settings, 'theme' | 'bgColor' | 'bodyColor' | 'panelBgColor'>
}
export const APPEARANCE_BASES = {
  light: { bgColor: '#f3f5f4', bodyColor: '#20231f', panelBgColor: '#ffffff' },
  dark: { bgColor: '#171918', bodyColor: '#dfe3df', panelBgColor: '#202321' }
}

export function appearanceColors(settings: AppearancePreset['patch']): typeof APPEARANCE_BASES.light {
  const base = APPEARANCE_BASES[settings.theme]
  return {
    bgColor: (settings.bgColor || base.bgColor).toLowerCase(),
    bodyColor: (settings.bodyColor || base.bodyColor).toLowerCase(),
    panelBgColor: (settings.panelBgColor || base.panelBgColor).toLowerCase()
  }
}

export function matchesAppearancePreset(settings: Settings, preset: AppearancePreset): boolean {
  if (settings.theme !== preset.patch.theme) return false
  const current = appearanceColors(settings)
  const target = appearanceColors(preset.patch)
  return current.bgColor === target.bgColor && current.bodyColor === target.bodyColor && current.panelBgColor === target.panelBgColor
}

export const APPEARANCE_PRESETS: AppearancePreset[] = [
  { id: 'light', label: '纸白', description: '清晰 · 中性纸色', patch: { theme: 'light', bgColor: '', bodyColor: '', panelBgColor: '' } },
  { id: 'sepia', label: '暖纸', description: '柔和 · 米色纸面', patch: { theme: 'light', bgColor: '#f4eedf', bodyColor: '#403a30', panelBgColor: '#ede5d6' } },
  { id: 'green', label: '雾绿', description: '低饱和 · 浅绿底', patch: { theme: 'light', bgColor: '#e7eee7', bodyColor: '#29392e', panelBgColor: '#dde6dc' } },
  { id: 'gray', label: '灰纸', description: '冷静 · 灰色纸面', patch: { theme: 'light', bgColor: '#e5e8ea', bodyColor: '#30373b', panelBgColor: '#dbe0e3' } },
  { id: 'dark', label: '柔夜', description: '暗色 · 柔白文字', patch: { theme: 'dark', bgColor: '', bodyColor: '', panelBgColor: '' } },
  { id: 'night', label: '深夜', description: '更暗 · 降低字亮度', patch: { theme: 'dark', bgColor: '#101312', bodyColor: '#bfc7c2', panelBgColor: '#191e1b' } },
  { id: 'ink', label: '墨蓝', description: '灰蓝 · 冷调夜色', patch: { theme: 'dark', bgColor: '#20272c', bodyColor: '#d8e0e5', panelBgColor: '#293138' } }
]

// Settings → CSS 变量映射（挂到 document.documentElement）。值为 null = 移除该属性（让 CSS 兜底默认生效）。
// 颜色/字体为空时移除属性，使消费方 var(--x, 主题默认) 回落到主题；有值才覆盖。
export function toCssVars(s: Settings): Record<string, string | null> {
  return {
    '--token-gap': `${s.tokenGap}em`,
    '--token-letter-spacing': `${s.tokenLetterSpacing}em`,
    '--token-bg-color': s.tokenBgColor || TOKEN_BG_COLOR_DEFAULT,
    '--token-bg-opacity': String(s.tokenBgOpacity),
    '--token-bg-opacity-percent': `${s.tokenBgOpacity * 100}%`,
    '--reader-body-size': `${s.bodySize}rem`,
    '--reader-line-height': String(s.lineHeight),
    '--reader-left-margin': `${s.leftMargin}%`,
    '--reader-right-margin': `${s.rightMargin}%`,
    // 清理升级前可能仍挂在根节点上的旧变量，避免当前会话残留旧布局。
    '--reader-margin': null,
    '--reader-content-width': null,
    '--reader-seg-gap': `${s.segGap}rem`,
    '--reader-heading-size': `${s.headingSize}rem`,
    '--reader-zh-size': `${s.zhSize}rem`,
    '--reader-zh-weight': String(s.zhWeight),
    '--reader-zh-opacity': String(s.zhOpacity),
    '--furigana-size': `${s.furiganaSize}em`,
    '--furigana-opacity': String(s.furiganaOpacity),
    '--toc-font-size': `${s.tocFontSize}rem`,
    '--ai-font-size': `${s.aiFontSize}rem`,
    '--reader-font-weight': String(s.fontWeight),
    '--reader-vertical-body-size': `${s.verticalBodySize}rem`,
    '--reader-vertical-line-height': String(s.verticalLineHeight),
    '--reader-vertical-column-gap': `${s.verticalColumnGap}rem`,
    '--reader-vertical-top-margin': `${s.verticalTopMargin}%`,
    '--reader-vertical-bottom-margin': `${s.verticalBottomMargin}%`,
    '--reader-vertical-token-gap': `${s.verticalTokenGap}em`,
    '--reader-vertical-token-letter-spacing': `${s.verticalTokenLetterSpacing}em`,
    '--reader-body-color': s.bodyColor || null,
    '--furigana-color': s.furiganaColor || null,
    '--reader-zh-color': s.zhColor || null,
    '--reader-bg': s.bgColor || null,
    '--reader-panel-bg': s.panelBgColor || null,
    '--reader-font-jp': s.fontJp || null,
    '--reader-font-zh': s.fontZh || null
  }
}
