// settings 最小自测（铁律 4，纯逻辑无 DOM/网络）：
//   ① 数值 clamp（每个旋钮）：界内原样 / 越界钳 min-max / NaN/脏值兜底默认
//   ② 颜色 sanitize：合法 #rgb/#rrggbb 留 / 非法回默认 / 空串=跟随主题
//   ③ 字体 family 名合法化：剔除 CSS 注入字符（; { } ( ) 引号 反斜杠 换行）
//   ④ settings 序列化往返：coerce 补齐缺字段（向前兼容，加旋钮不炸旧数据）
// Dialog/Tabs/CSS 变量应用/字体 @font-face/字体落盘 靠 typecheck+build+dev 手验。
// 跑法：node scripts/settings-selftest.mjs
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import assert from 'node:assert'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const dir = resolve(root, 'src/renderer/src/modules/settings')

// 转纯逻辑 TS（无 DOM/electron）→ 临时 .mjs 加载。
function load(name) {
  const src = readFileSync(join(dir, name + '.ts'), 'utf8')
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const out = join(dir, `__selftest_${name}.mjs`)
  writeFileSync(out, js)
  return out
}
const toUrl = (p) => 'file://' + p.replace(/\\/g, '/')

const logicPath = load('settings-logic')

let ok = false
try {
  const {
    clampKnob,
    RANGES,
    sanitizeColor,
    sanitizeFontFamily,
    coerceSettings,
    toCssVars,
    DEFAULT_SETTINGS,
    TOKEN_BG_COLOR_DEFAULT,
    TOKEN_STYLES,
    APPEARANCE_PRESETS,
    APPEARANCE_BASES,
    appearanceColors,
    matchesAppearancePreset
  } = await import(toUrl(logicPath))

  // ① 数值 clamp：遍历每个旋钮，界内原样 / 越界钳 / NaN 兜底默认。
  for (const [knob, r] of Object.entries(RANGES)) {
    const mid = (r.min + r.max) / 2
    assert.strictEqual(clampKnob(knob, mid), mid, `${knob} 界内原样`)
    assert.strictEqual(clampKnob(knob, r.max + 100), r.max, `${knob} 越上界钳 max`)
    assert.strictEqual(clampKnob(knob, r.min - 100), r.min, `${knob} 越下界钳 min`)
    assert.strictEqual(clampKnob(knob, NaN), r.def, `${knob} NaN 兜底默认`)
    assert.strictEqual(clampKnob(knob, Number('脏')), r.def, `${knob} 脏值兜底默认`)
  }

  // ② 颜色 sanitize：合法留 / 非法回默认 / 空串=跟随主题。
  assert.strictEqual(sanitizeColor('#abc', '#000000'), '#abc', '合法 #rgb 留')
  assert.strictEqual(sanitizeColor('#6b8cae', '#000000'), '#6b8cae', '合法 #rrggbb 留')
  assert.strictEqual(sanitizeColor('red', '#111111'), '#111111', '非法回默认')
  assert.strictEqual(sanitizeColor('#12', '#111111'), '#111111', '半截 hex 回默认')
  assert.strictEqual(sanitizeColor('', '#111111'), '', '空串=跟随主题（不回默认）')
  assert.strictEqual(sanitizeColor(null, '#111111'), '#111111', 'null 回默认')

  // ③ 字体 family 合法化：剔除注入字符。
  assert.strictEqual(sanitizeFontFamily('Yu Mincho'), 'Yu Mincho', '正常名原样')
  assert.strictEqual(sanitizeFontFamily('黑体 SimHei'), '黑体 SimHei', 'CJK 保留')
  assert.strictEqual(
    sanitizeFontFamily('a; } body{display:none}'),
    'a  bodydisplay:none',
    '剔除 ; { } 防注入'
  )
  assert.ok(!sanitizeFontFamily('x"><script>').includes('"'), '剔除引号/尖括号')
  assert.ok(!sanitizeFontFamily("url('x')").includes('('), '剔除括号')
  assert.ok(!sanitizeFontFamily('a\nb').includes('\n'), '剔除换行')
  assert.strictEqual(sanitizeFontFamily(''), '', '空串=跟随主题')

  // ④ 序列化往返 + 向前兼容：缺字段用默认补齐、脏值夹取。
  const full = coerceSettings(DEFAULT_SETTINGS)
  const roundtrip = coerceSettings(JSON.parse(JSON.stringify(full)))
  assert.deepStrictEqual(roundtrip, full, 'JSON 往返一致')
  // 空对象（旧数据无任何字段）→ 全默认。
  const fromEmpty = coerceSettings({})
  assert.deepStrictEqual(fromEmpty, DEFAULT_SETTINGS, '缺全部字段=全默认')
  // 部分字段 + 脏值混合：已知字段保留合法值、脏的夹取、缺的补默认。
  const partial = coerceSettings({ bodySize: 1.8, lineHeight: 999, mode: 'A', extra: 'x' })
  assert.strictEqual(partial.bodySize, 1.8, '合法字段保留')
  assert.strictEqual(partial.lineHeight, RANGES.lineHeight.max, '越界字段夹取')
  assert.strictEqual(partial.mode, 'A', '枚举保留')
  assert.strictEqual(partial.furigana, true, '缺字段补默认')
  assert.strictEqual(partial.tokenBgColor, TOKEN_BG_COLOR_DEFAULT, '缺颜色补默认')
  assert.strictEqual(partial.leftMargin, 8, '缺左边距补默认百分比')
  assert.strictEqual(partial.rightMargin, 8, '缺右边距补默认百分比')
  const migratedMargin = coerceSettings({ margin: 3.25, contentWidth: 60 })
  assert.strictEqual(migratedMargin.leftMargin, 3.25, '旧统一边距迁移为左边距')
  assert.strictEqual(migratedMargin.rightMargin, 3.25, '旧统一边距迁移为右边距')
  const asymmetricMargin = coerceSettings({ leftMargin: 8, rightMargin: 2 })
  assert.strictEqual(asymmetricMargin.leftMargin, 8, '左边距独立保留')
  assert.strictEqual(asymmetricMargin.rightMargin, 2, '右边距独立保留')
  // 非法枚举回默认。
  assert.strictEqual(coerceSettings({ mode: 'Z' }).mode, 'C', '非法 mode 回 C')
  assert.strictEqual(coerceSettings({ theme: 'x' }).theme, 'light', '非法 theme 回 light')
  assert.strictEqual(DEFAULT_SETTINGS.tokenStyle, 'capsule-soft', '词框样式默认轻柔胶囊')
  for (const style of TOKEN_STYLES) {
    assert.strictEqual(coerceSettings({ tokenStyle: style }).tokenStyle, style, `合法词框样式 ${style} 保留`)
    const roundTrip = coerceSettings(JSON.parse(JSON.stringify({ ...DEFAULT_SETTINGS, tokenStyle: style })))
    assert.strictEqual(roundTrip.tokenStyle, style, `词框样式 ${style} JSON 往返保留`)
  }
  assert.strictEqual(coerceSettings({ tokenStyle: 'brick' }).tokenStyle, 'capsule-soft', '非法词框样式回默认')
  assert.strictEqual(coerceSettings({}).tokenStyle, 'capsule-soft', '旧数据缺词框样式补默认')
  // 非对象输入不炸。
  assert.deepStrictEqual(coerceSettings(null), DEFAULT_SETTINGS, 'null 输入=全默认')
  assert.deepStrictEqual(coerceSettings('乱'), DEFAULT_SETTINGS, '字符串输入=全默认')

  // ⑤ toCssVars：颜色/字体为空 → null（移除属性让 CSS 兜底）；有值 → 覆盖。
  const vars = toCssVars(DEFAULT_SETTINGS)
  assert.strictEqual(vars['--reader-body-size'], '1.2rem', '正文字号带单位')
  assert.strictEqual(vars['--reader-left-margin'], '8%', '左边距使用阅读区百分比')
  assert.strictEqual(vars['--reader-right-margin'], '8%', '右边距使用阅读区百分比')
  assert.strictEqual(vars['--reader-margin'], null, '主动移除旧统一边距变量')
  assert.strictEqual(vars['--reader-content-width'], null, '主动移除旧内容宽度变量')
  assert.strictEqual(vars['--reader-body-color'], null, '空正文色 → null（跟随主题）')
  assert.strictEqual(vars['--reader-bg'], null, '空阅读背景 → null')
  assert.strictEqual(vars['--reader-panel-bg'], null, '空面板背景 → null')
  assert.strictEqual(vars['--reader-font-jp'], null, '空日文字体 → null')
  assert.strictEqual(vars['--token-bg-color'], TOKEN_BG_COLOR_DEFAULT, '词框色有默认值')
  assert.strictEqual(vars['--token-bg-opacity-percent'], '18%', '默认词框透明度映射为百分比')
  assert.strictEqual(toCssVars(coerceSettings({ tokenBgOpacity: 0 }))['--token-bg-opacity-percent'], '0%', '零透明度映射为 0%')
  assert.strictEqual(toCssVars(coerceSettings({ tokenBgOpacity: 1 }))['--token-bg-opacity-percent'], '100%', '满透明度映射为 100%')

  const withFont = toCssVars(coerceSettings({ fontJp: 'Yu Mincho', bodyColor: '#123456' }))
  assert.strictEqual(withFont['--reader-font-jp'], 'Yu Mincho', '有字体 → 覆盖')
  assert.strictEqual(withFont['--reader-body-color'], '#123456', '有颜色 → 覆盖')

  // 设置调整需要直接观察阅读区：设置专用遮罩不得模糊或染暗背景。
  const dialogSource = readFileSync(resolve(root, 'src/renderer/src/components/ui/dialog.tsx'), 'utf8')
  const settingsDialogSource = readFileSync(join(dir, 'SettingsDialog.tsx'), 'utf8')
  assert.match(
    dialogSource,
    /<DialogOverlay className=\{overlayClassName\} \/>/,
    'DialogContent 将调用方的遮罩样式传给真实 Overlay'
  )
  assert.match(
    settingsDialogSource,
    /overlayClassName=["']bg-transparent backdrop-blur-none["']/,
    '设置弹窗使用无模糊、无染色遮罩，便于准确观察阅读区变化'
  )
  const settingsCss = readFileSync(join(dir, 'settings.css'), 'utf8')
  assert.match(settingsCss, /\.settings-dialog\[data-state=['"]open['"]\]/, '设置面板打开态覆盖 Dialog 居中定位')
  assert.match(settingsCss, /inset:\s*0\s+0\s+0\s+auto\s*!important/, '设置面板固定贴合右侧并占满窗口高度')
  assert.match(settingsCss, /translate:\s*none\s*!important/, '设置面板清除 Tailwind 独立 translate 位移')
  assert.match(settingsCss, /transform:\s*none\s*!important/, '设置面板不继承居中位移')
  assert.match(settingsCss, /\.settings-font-row\s*\{[\s\S]*?min-width:\s*0/, '字体设置行允许在窄面板内收缩')
  assert.match(settingsCss, /\.settings-font-list li > span\s*\{[\s\S]*?text-overflow:\s*ellipsis/, '导入字体文件名超长时省略显示')
  const withBg = toCssVars(coerceSettings({ bgColor: '#f5ecd9', panelBgColor: '#efe4cc' }))
  assert.strictEqual(withBg['--reader-bg'], '#f5ecd9', '有阅读背景 → 覆盖')
  assert.strictEqual(withBg['--reader-panel-bg'], '#efe4cc', '有面板背景 → 覆盖')

  // ⑥ 外观预设：结构合法（含 theme + 三色槽），颜色值经 coerce 后仍合法。
  assert.ok(APPEARANCE_PRESETS.length >= 5, '预设 ≥5 个')
  for (const p of APPEARANCE_PRESETS) {
    assert.ok(p.patch.theme === 'light' || p.patch.theme === 'dark', `${p.id} theme 合法`)
    // 预设色应通过 sanitize（空 或 合法 hex）。
    for (const c of [p.patch.bgColor, p.patch.bodyColor, p.patch.panelBgColor]) {
      assert.strictEqual(sanitizeColor(c, '#000000'), c, `${p.id} 预设色已合法（sanitize 不变）`)
    }
    const applied = coerceSettings({ ...DEFAULT_SETTINGS, ...p.patch })
    assert.ok(matchesAppearancePreset(applied, p), `${p.id} 应用后显示为选中`)
    assert.strictEqual(APPEARANCE_PRESETS.filter((preset) => matchesAppearancePreset(applied, preset)).length, 1, '预设不能重复配色或多选')
    assert.strictEqual(applied.leftMargin, DEFAULT_SETTINGS.leftMargin, '配色不改变边距')
    assert.strictEqual(applied.bodySize, DEFAULT_SETTINGS.bodySize, '配色不改变字号')
    const colors = appearanceColors(p.patch)
    const luminance = (hex) => {
      const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
      const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
    }
    const foreground = luminance(colors.bodyColor)
    const background = luminance(colors.bgColor)
    const contrast = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
    assert.ok(contrast >= 7, `${p.id} 正文与背景对比度 ${contrast.toFixed(2)} 不应低于 7`)
  }
  assert.ok(matchesAppearancePreset(DEFAULT_SETTINGS, APPEARANCE_PRESETS[0]), '原有空色槽设置仍识别默认纸白')
  assert.ok(!APPEARANCE_PRESETS.some((preset) => matchesAppearancePreset(coerceSettings({ bgColor: '#abcdef' }), preset)), '手动改色后显示自定义')
  const themeCss = readFileSync(resolve(root, 'src/renderer/src/index.css'), 'utf8')
  for (const base of Object.values(APPEARANCE_BASES)) {
    for (const color of Object.values(base)) assert.ok(themeCss.includes(color), '默认预览颜色与主题基底一致')
  }
  // 左右边距分别夹取，足够覆盖大屏横向定位。
  const clampedMargins = coerceSettings({ leftMargin: 200, rightMargin: -5 })
  assert.strictEqual(clampedMargins.leftMargin, RANGES.leftMargin.max, 'leftMargin 越界钳 max')
  assert.strictEqual(clampedMargins.rightMargin, RANGES.rightMargin.min, 'rightMargin 越界钳 min')

  ok = true
  console.log(
    'OK: settings 全绿（clamp 全旋钮界内/钳/NaN兜底 · 颜色 sanitize · 字体名防注入 · coerce 往返+向前兼容+脏值夹取 · toCssVars 空→null）'
  )
} finally {
  rmSync(logicPath, { force: true })
}
if (!ok) process.exit(1)
