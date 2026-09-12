// reader-view 最小自测（铁律 4）：验纯逻辑 —— ruby 振假名助手（片假名→平假名、
// 该不该注音）。这是 reader-view 独有的非平凡算法；Virtuoso 渲染/分词管道靠
// typecheck+build+dev 手验（需 DOM/Worker，不入纯 node 自测）。
// 跑法：node scripts/reader-selftest.mjs（纯逻辑，无 electron/DOM 依赖）。
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import assert from 'node:assert'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const rvDir = resolve(root, 'src/renderer/src/modules/reader-view')

// ruby.ts / chapter-nav.ts 无 DOM、只 type-only import（transpile 擦除）—— 直接转临时 .mjs 加载。
function transpile(name) {
  const src = readFileSync(join(rvDir, name + '.ts'), 'utf8')
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const out = join(rvDir, `__selftest_${name}.mjs`)
  writeFileSync(out, js)
  return out
}
const rubyOut = transpile('ruby')
const navOut = transpile('chapter-nav')
const logicOut = transpile('reader-logic')

let ok = false
try {
  const { kataToHira, hasKanji, furiganaFor } = await import(
    'file://' + rubyOut.replace(/\\/g, '/')
  )
  const { chapterLabel, findChapterIndex } = await import('file://' + navOut.replace(/\\/g, '/'))
  const { toggleHoveredZh, clampWidth, clampTokenGap, clampOpacity, sanitizeHexColor } =
    await import('file://' + logicOut.replace(/\\/g, '/'))

  // ① 片假名→平假名。
  assert.strictEqual(kataToHira('ヨンダ'), 'よんだ', '片假名应转平假名')
  assert.strictEqual(kataToHira('ホン'), 'ほん')
  // 非假名原样（汉字/拉丁/长音记号）。
  assert.strictEqual(kataToHira('本ABC'), '本ABC')

  // ② 汉字检测。
  assert.ok(hasKanji('読む'), '含汉字')
  assert.ok(!hasKanji('よむ'), '纯假名不含汉字')
  assert.ok(!hasKanji('ABC'))

  // ③ 振假名决策：含汉字且读音≠表层 → 注；纯假名/符号 → 不注。
  assert.strictEqual(furiganaFor('本', 'ホン'), 'ほん', '汉字词应给平假名振假名')
  assert.strictEqual(furiganaFor('読ん', 'ヨン'), 'よん', '送假名词按读音注')
  assert.strictEqual(furiganaFor('です', 'デス'), null, '纯假名不注')
  assert.strictEqual(furiganaFor('、', '、'), null, '符号不注')
  // 读音平假名化后与表层相同则不注（避免冗余）。
  assert.strictEqual(furiganaFor('ひらがな', 'ヒラガナ'), null)

  // ④ 目录占位标题（决策 1：全列各章，空标题补占位）。
  assert.strictEqual(chapterLabel({ title: '第一話' }, 0), '第一話', '有标题用标题')
  assert.strictEqual(chapterLabel({ title: '  ' }, 4), '第 5 节', '空标题给「第N节」占位（N=位次+1）')
  assert.strictEqual(chapterLabel({ title: '' }, 2, true), '插图', '纯图片章占位「插图」')

  // ⑤ 按全局 seq 反查所属章（章边界计算：段连续，闭区间 [startSeq,endSeq]）。
  const chs = [
    { startSeq: 0, endSeq: 9 },
    { startSeq: 10, endSeq: 29 },
    { startSeq: 30, endSeq: 30 }
  ]
  assert.strictEqual(findChapterIndex(chs, 0), 0, '首段落第0章')
  assert.strictEqual(findChapterIndex(chs, 9), 0, '章末边界仍属该章')
  assert.strictEqual(findChapterIndex(chs, 10), 1, '下章首段')
  assert.strictEqual(findChapterIndex(chs, 30), 2, '末章单段')
  assert.strictEqual(findChapterIndex(chs, 999), 2, '超界兜底最近前一章')
  assert.strictEqual(findChapterIndex([], 5), -1, '空章节表返回 -1')

  // ⑥ t 键悬停切译文（会话 9.1）：命中翻转、再按收起；空悬停(null)不响应，防误触。
  assert.deepStrictEqual([...toggleHoveredZh(new Set(), 5)], [5], '悬停命中 → 展开')
  assert.deepStrictEqual([...toggleHoveredZh(new Set([5]), 5)], [], '再按 → 收起')
  assert.deepStrictEqual([...toggleHoveredZh(new Set([5]), 8)], [5, 8], '悬停另一段 → 并存')
  assert.deepStrictEqual([...toggleHoveredZh(new Set([5]), null)], [5], '空悬停 → 原样不响应')
  assert.deepStrictEqual([...toggleHoveredZh(new Set(), null)], [], '空悬停空集 → 仍空')
  // 不可变：不改入参集合。
  const before = new Set([1])
  toggleHoveredZh(before, 2)
  assert.deepStrictEqual([...before], [1], 'toggle 不改入参')

  // ⑦ 面板拖宽夹取（会话 9.1）：越界钳到 min/max，界内原样。
  assert.strictEqual(clampWidth(300, 160, 448), 300, '界内原样')
  assert.strictEqual(clampWidth(50, 160, 448), 160, '拖没 → 钳到 min')
  assert.strictEqual(clampWidth(9999, 160, 448), 448, '拖爆 → 钳到 max')

  // ⑧ 词框间距夹取（会话 11）：界内原样、越界钳 [0,0.5]em、脏值(NaN)兜底默认 0.02。
  assert.strictEqual(clampTokenGap(0.2), 0.2, '界内原样')
  assert.strictEqual(clampTokenGap(-1), 0, '负值 → 钳到 0')
  assert.strictEqual(clampTokenGap(1.5), 0.5, '过大 → 钳到 0.5')
  assert.strictEqual(clampTokenGap(NaN), 0.02, 'NaN(脏 localStorage) → 默认 0.02')
  assert.strictEqual(clampTokenGap(Number('abc')), 0.02, '非数解析 → 默认 0.02')

  // ⑨ 词框底色透明度夹取 + 颜色兜底（会话 11.1）。
  assert.strictEqual(clampOpacity(0.5), 0.5, '界内原样')
  assert.strictEqual(clampOpacity(-0.2), 0, '负 → 0')
  assert.strictEqual(clampOpacity(2), 1, '过大 → 1')
  assert.strictEqual(clampOpacity(NaN), 0.18, 'NaN → 默认 0.18')
  assert.strictEqual(sanitizeHexColor('#abc'), '#abc', '#rgb 合法')
  assert.strictEqual(sanitizeHexColor('#6b8cae'), '#6b8cae', '#rrggbb 合法')
  assert.strictEqual(sanitizeHexColor('red'), '#6b8cae', '非十六进制 → 默认色')
  assert.strictEqual(sanitizeHexColor(null), '#6b8cae', 'null(未存) → 默认色')

  // ⑩ 六种词框样式：透明度矩阵、特殊表面和交互态布局稳定性。
  const tokenStyles = [
    'capsule-soft',
    'capsule-clear',
    'capsule-minimal',
    'marker',
    'underline',
    'classic'
  ]
  const tokenCss = readFileSync(join(rvDir, 'token-styles.css'), 'utf8')
  const styleBlock = (style) => {
    const match = tokenCss.match(new RegExp(`\\[data-token-style=['"]${style}['"]\\]\\s*\\{([^}]*)\\}`))
    assert.ok(match, `词框 CSS 含 ${style} 变量定义`)
    return match[1]
  }
  for (const style of tokenStyles) {
    const block = styleBlock(style)
    const fill = Number(block.match(/--token-style-fill-strength:\s*([\d.]+)%/)?.[1]) / 100
    const border = Number(block.match(/--token-style-border-strength:\s*([\d.]+)%/)?.[1]) / 100
    assert.ok(Number.isFinite(fill) && Number.isFinite(border), `${style} 定义填充和边线强度`)
    for (const opacity of [0, 0.18, 1]) {
      assert.ok(opacity * fill >= 0 && opacity * fill <= 1, `${style} opacity=${opacity} 填充强度合法`)
      assert.ok(opacity * border >= 0 && opacity * border <= 1, `${style} opacity=${opacity} 边线强度合法`)
      if (opacity === 0) {
        assert.strictEqual(opacity * fill, 0, `${style} opacity=0 静止填充完全透明`)
        assert.strictEqual(opacity * border, 0, `${style} opacity=0 静止边线完全透明`)
      }
    }
  }
  assert.match(tokenCss, /\[data-token-style='marker'\][\s\S]*?linear-gradient\(/, 'marker 使用下半部色带')
  assert.match(tokenCss, /\[data-token-style='underline'\][\s\S]*?border-bottom-color:/, 'underline 仅使用底边线')
  const hoverRule = tokenCss.match(/\.reader-token:hover\s*\{([^}]*)\}/)?.[1] ?? ''
  const activeRule = tokenCss.match(/\.reader-token:active\s*\{([^}]*)\}/)?.[1] ?? ''
  assert.match(hoverRule, /background:/, '透明度为 0 时 hover 仍有主题反馈')
  assert.match(activeRule, /background:/, '按下时仍有主题反馈')
  assert.doesNotMatch(
    `${hoverRule}${activeRule}`,
    /(?:padding|margin|border-width|font-size|line-height)\s*:/,
    '交互态不改变尺寸'
  )

  // ⑪ 目录是覆盖层而非正文的 flex 兄弟：开合/拖宽不改变正文可用宽度。
  const readerSource = readFileSync(join(rvDir, 'Reader.tsx'), 'utf8')
  const readerCss = readFileSync(join(rvDir, 'reader.css'), 'utf8')
  assert.match(
    readerSource,
    /className="reader-toc-layer"[\s\S]*?<TocSidebar[\s\S]*?<div[\s\S]*?className="reader-resizer"/,
    '目录与拖拽柄包在独立覆盖层内'
  )
  const bodyRule = readerCss.match(/\.reader-body\s*\{([^}]*)\}/)?.[1] ?? ''
  const tocLayerRule = readerCss.match(/\.reader-toc-layer\s*\{([^}]*)\}/)?.[1] ?? ''
  assert.match(bodyRule, /position:\s*relative/, '正文主体建立目录覆盖层定位上下文')
  assert.match(tocLayerRule, /position:\s*absolute/, '目录层脱离正文 flex 布局')
  assert.match(tocLayerRule, /inset:\s*0 auto 0 0/, '目录层固定覆盖正文左侧全高')
  assert.match(tocLayerRule, /z-index:\s*\d+/, '目录层位于正文之上')

  const toolbarPrimary = readerSource.match(/className="reader-toolbar-primary"[\s\S]*?className="reader-toolbar-secondary"/)?.[0] ?? ''
  assert.match(toolbarPrimary, /onClick=\{p\.onToc\}/, '目录按钮位于工具栏左侧主操作组')
  assert.match(toolbarPrimary, /<PlaybackBar[\s\S]*?className="reader-toolbar-chapter"/, '朗读按钮位于工具栏左侧主操作组')

  // ⑫ 正文横向位置由独立左右边距控制，不再被居中的内容最大宽度锁住。
  const segmentRule = readerCss.match(/\.reader-seg\s*\{([^}]*)\}/)?.[1] ?? ''
  assert.match(segmentRule, /max-width:\s*none/, '正文不再受固定内容宽度限制')
  assert.match(segmentRule, /box-sizing:\s*border-box/, '左右边距会压缩正文可用宽度')
  assert.match(segmentRule, /var\(--reader-left-margin/, '正文消费独立左边距')
  assert.match(segmentRule, /var\(--reader-right-margin/, '正文消费独立右边距')
  const bodyTextRule = readerCss.match(/\.reader-pair\s*\{([^}]*)\}/)?.[1] ?? ''
  assert.match(bodyTextRule, /width:\s*auto/, '正文占满左右边距之间的区域')
  assert.doesNotMatch(bodyTextRule, /margin-inline:\s*auto/, '正文右边缘不因居中而平移')

  ok = true
  console.log(
    'OK: reader-view 全绿（ruby / 目录导航与覆盖布局 / 译文切换 / 面板宽度 / 词框样式）'
  )
} finally {
  rmSync(rubyOut, { force: true })
  rmSync(navOut, { force: true })
  rmSync(logicOut, { force: true })
}
if (!ok) process.exit(1)
