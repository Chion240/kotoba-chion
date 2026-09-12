// ai-translation · 设置「翻译」分区（独立翻译 API 配置：连接 + 提示词，与 AI 分析档案分开）。
// 视图直读翻译配置 store（单一真值），改即写 localStorage。复用 settings.css 的 .settings-field 样式。
import { useTranslationConfig, setTranslationConfig } from './translation-config'

function Field({
  label,
  value,
  onChange,
  multiline,
  password
}: {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  password?: boolean
}): React.JSX.Element {
  return (
    <div className="settings-field">
      <label>{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          type={password ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}

export function TranslationTab(): React.JSX.Element {
  const c = useTranslationConfig()
  return (
    <>
      <p className="settings-hint">
        纯日语书按 <kbd>t</kbd> 的 AI 译文用这套配置（与「AI 档案」分析连接相互独立）。
      </p>
      <Field label="baseURL" value={c.baseURL} onChange={(v) => setTranslationConfig({ baseURL: v })} />
      <Field
        label="apiKey（明文存本地）"
        value={c.apiKey}
        onChange={(v) => setTranslationConfig({ apiKey: v })}
        password
      />
      <Field label="model" value={c.model} onChange={(v) => setTranslationConfig({ model: v })} />
      <Field
        label="翻译提示词"
        value={c.systemPrompt}
        onChange={(v) => setTranslationConfig({ systemPrompt: v })}
        multiline
      />
      <Field
        label="temperature"
        value={String(c.temperature ?? '')}
        onChange={(v) =>
          setTranslationConfig({ temperature: v === '' ? undefined : Number(v) })
        }
      />
    </>
  )
}
