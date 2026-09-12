// settings · 面板内复用控件：滑块行 / 颜色行 / 开关行。全走主题语义色，不写死颜色。
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { RANGES, type NumericKnob, type Settings } from './settings-logic'
import { setSetting } from './settings-store'

// 数值滑块行：读 settings[knob]，onValueChange 写 store（store 内 coerce 夹取）。
export function SliderRow({
  knob,
  label,
  value,
  step = 0.01,
  suffix
}: {
  knob: NumericKnob
  label: string
  value: number
  step?: number
  suffix?: string
}): React.JSX.Element {
  const r = RANGES[knob]
  return (
    <div className="settings-row">
      <span className="settings-label">{label}</span>
      <Slider
        className="settings-slider"
        min={r.min}
        max={r.max}
        step={step}
        value={[value]}
        onValueChange={(v) => setSetting(knob, v[0])}
      />
      <span className="settings-value">
        {value}
        {suffix ?? ''}
      </span>
    </div>
  )
}

// 颜色行：<input type=color>（仿 reader 现有 .reader-color-input）。空值=跟随主题；「跟随主题」按钮清空。
export function ColorRow({
  colorKey,
  label,
  value
}: {
  colorKey: 'tokenBgColor' | 'bodyColor' | 'furiganaColor' | 'zhColor' | 'bgColor' | 'panelBgColor'
  label: string
  value: string
}): React.JSX.Element {
  return (
    <div className="settings-row">
      <span className="settings-label">{label}</span>
      <input
        type="color"
        className="settings-color"
        value={value || '#000000'}
        onChange={(e) => setSetting(colorKey, e.target.value)}
      />
      {value && (
        <button className="settings-mini-btn" onClick={() => setSetting(colorKey, '')}>
          跟随主题
        </button>
      )}
    </div>
  )
}

// 开关行（Switch）。
export function SwitchRow({
  boolKey,
  label,
  value
}: {
  boolKey: 'furigana' | 'allZh'
  label: string
  value: boolean
}): React.JSX.Element {
  return (
    <div className="settings-row">
      <span className="settings-label">{label}</span>
      <Switch checked={value} onCheckedChange={(v: boolean) => setSetting(boolKey, v)} />
    </div>
  )
}

export type { Settings }
