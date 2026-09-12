import { useId, type CSSProperties } from 'react'
import { Check } from 'lucide-react'
import {
  APPEARANCE_PRESETS,
  appearanceColors,
  matchesAppearancePreset,
  type AppearancePreset,
  type Settings
} from './settings-logic'

export function AppearancePresetPicker({ settings, onSelect }: {
  settings: Settings
  onSelect: (preset: AppearancePreset) => void
}): React.JSX.Element {
  const group = useId()
  const active = APPEARANCE_PRESETS.find((preset) => matchesAppearancePreset(settings, preset))
  return (
    <fieldset className="settings-preset-field">
      <legend className="settings-preset-status">当前：{active?.label ?? '自定义配色'}</legend>
      <div className="settings-preset-grid">
        {APPEARANCE_PRESETS.map((preset) => {
          const colors = appearanceColors(preset.patch)
          const selected = active?.id === preset.id
          const style = {
            '--preset-bg': colors.bgColor,
            '--preset-ink': colors.bodyColor,
            '--preset-panel': colors.panelBgColor
          } as CSSProperties
          return (
            <label className="settings-preset" key={preset.id} style={style}>
              <input
                type="radio"
                name={group}
                value={preset.id}
                checked={selected}
                onChange={() => onSelect(preset)}
                aria-label={`${preset.label}，${preset.description}`}
              />
              <span className="settings-preset-preview" aria-hidden="true">
                <span lang="ja">静かな一頁</span>
                <span className="settings-preset-rule" />
              </span>
              <span className="settings-preset-caption">
                <span className="settings-preset-name">{preset.label}<Check aria-hidden="true" /></span>
                <span className="settings-preset-description">{preset.description}</span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
