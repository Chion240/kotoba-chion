// settings · 字体分区：日文正文 / 中文译文两个字体族槽 + 导入字体（CR-4）。
// 槽值 = 字体族名（预设 / 已导入字体 family / 手输系统字体名）。空 = 跟随主题默认栈。
import { setSetting } from './settings-store'
import type { Settings } from './settings-logic'
import type { FontMeta } from '../../../../shared/contracts'
import { Button } from '@/components/ui/button'

// 常见日文/中文预设字体族（明朝/黑体几项）。系统无该字体时浏览器回落，无害。
const PRESETS = [
  { label: '跟随主题', value: '' },
  { label: '游明朝 Yu Mincho', value: 'Yu Mincho' },
  { label: 'Noto Serif JP', value: 'Noto Serif JP' },
  { label: '游ゴシック Yu Gothic', value: 'Yu Gothic' },
  { label: 'Noto Sans JP', value: 'Noto Sans JP' },
  { label: 'MS 明朝', value: 'MS Mincho' },
  { label: '黑体 SimHei', value: 'SimHei' },
  { label: '宋体 SimSun', value: 'SimSun' }
]

function FontSelect({
  label,
  slot,
  value,
  fonts
}: {
  label: string
  slot: 'fontJp' | 'fontZh'
  value: string
  fonts: FontMeta[]
}): React.JSX.Element {
  // 手输系统字体名：若当前值不在预设/导入列表里，标记为「自定义」保留显示。
  const known = [...PRESETS.map((p) => p.value), ...fonts.map((f) => f.family)]
  const isCustom = value !== '' && !known.includes(value)
  return (
    <div className="settings-row settings-font-row">
      <span className="settings-label">{label}</span>
      <select
        className="settings-select"
        value={isCustom ? '__custom' : value}
        onChange={(e) => {
          if (e.target.value === '__custom') return
          setSetting(slot, e.target.value)
        }}
      >
        {PRESETS.map((p) => (
          <option key={p.value || 'theme'} value={p.value}>
            {p.label}
          </option>
        ))}
        {fonts.length > 0 && (
          <optgroup label="已导入">
            {fonts.map((f) => (
              <option key={f.id} value={f.family}>
                {f.family}
              </option>
            ))}
          </optgroup>
        )}
        {isCustom && <option value="__custom">自定义：{value}</option>}
      </select>
      <input
        className="settings-font-input"
        placeholder="系统字体名"
        value={value}
        onChange={(e) => setSetting(slot, e.target.value)}
      />
    </div>
  )
}

export function FontTab({
  settings,
  fonts
}: {
  settings: Settings
  fonts: {
    fonts: FontMeta[]
    importFont: () => Promise<void>
    deleteFont: (id: string) => Promise<void>
  }
}): React.JSX.Element {
  return (
    <>
      <FontSelect label="日文正文" slot="fontJp" value={settings.fontJp} fonts={fonts.fonts} />
      <FontSelect label="中文译文" slot="fontZh" value={settings.fontZh} fonts={fonts.fonts} />
      <div className="settings-row settings-font-row">
        <span className="settings-label">导入字体</span>
        <Button variant="outline" size="sm" onClick={() => void fonts.importFont()}>
          + 导入 .ttf/.otf/.woff2
        </Button>
      </div>
      {fonts.fonts.length > 0 && (
        <ul className="settings-font-list">
          {fonts.fonts.map((f) => (
            <li key={f.id}>
              <span style={{ fontFamily: `'${f.family}'` }}>{f.fileName}</span>
              <button
                className="settings-mini-btn"
                onClick={() => void fonts.deleteFont(f.id)}
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
