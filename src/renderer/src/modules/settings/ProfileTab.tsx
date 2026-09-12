// settings · AI 档案分区（搬家）：原 AIPanel 的 ConfigDialog 内容移来。复用 ai-analysis 的 useAiProfiles CRUD。
// 功能不减：档案标签切换 + 编辑 name/baseURL/apiKey/model/systemPrompt/temperature + 增删档案。
import { useAiProfiles } from '../ai-analysis'
import type { AiProfile } from '../../../../shared/contracts'
import { Button } from '@/components/ui/button'

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

export function ProfileTab(): React.JSX.Element {
  const { state, ready, setActive, addProfile, updateProfile, deleteProfile } = useAiProfiles()
  const p: AiProfile | undefined =
    state.profiles.find((x) => x.id === state.activeId) ?? state.profiles[0]

  if (!ready || !p) return <div className="settings-empty">载入档案…</div>

  return (
    <>
      <div className="settings-tabs-row">
        {state.profiles.map((pr) => (
          <button
            key={pr.id}
            className={pr.id === state.activeId ? 'settings-seg is-active' : 'settings-seg'}
            onClick={() => setActive(pr.id)}
          >
            {pr.name}
          </button>
        ))}
        <button className="settings-mini-btn" onClick={addProfile}>
          + 新档案
        </button>
      </div>
      <Field label="名称" value={p.name} onChange={(v) => updateProfile(p.id, { name: v })} />
      <Field
        label="baseURL"
        value={p.baseURL}
        onChange={(v) => updateProfile(p.id, { baseURL: v })}
      />
      <Field
        label="apiKey（明文存本地）"
        value={p.apiKey}
        onChange={(v) => updateProfile(p.id, { apiKey: v })}
        password
      />
      <Field label="model" value={p.model} onChange={(v) => updateProfile(p.id, { model: v })} />
      <Field
        label="systemPrompt（提示词）"
        value={p.systemPrompt}
        onChange={(v) => updateProfile(p.id, { systemPrompt: v })}
        multiline
      />
      <Field
        label="temperature"
        value={String(p.temperature ?? '')}
        onChange={(v) => {
          // 空串→undefined（不发给 API）；NaN 也回落 undefined（防 temperature:null/NaN 落库）。
          if (v === '') {
            updateProfile(p.id, { temperature: undefined })
            return
          }
          const n = Number(v)
          updateProfile(p.id, { temperature: Number.isFinite(n) ? n : undefined })
        }}
      />
      <div className="settings-footer">
        <Button
          variant="destructive"
          size="sm"
          disabled={state.profiles.length <= 1}
          onClick={() => deleteProfile(p.id)}
        >
          删除此档案
        </Button>
      </div>
    </>
  )
}
