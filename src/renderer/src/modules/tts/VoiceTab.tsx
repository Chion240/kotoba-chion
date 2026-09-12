// settings「声音」分区（对标 ProfileTab）：声音档案 CRUD + 参考音频选择器。复用 useVoiceProfiles。
// Phase 1 只暴露 sovits 本地引擎字段；openai 云端字段 Phase 3 再补。复用 settings.css 的 .settings-field。
import { useVoiceProfiles } from './useVoiceProfiles'
import type { VoiceProfile } from '../../../../shared/contracts'
import { Button } from '@/components/ui/button'

function Field({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (v: string) => void
}): React.JSX.Element {
  return (
    <div className="settings-field">
      <label>{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

export function VoiceTab(): React.JSX.Element {
  const { state, ready, setActive, addProfile, updateProfile, deleteProfile } = useVoiceProfiles()
  const p: VoiceProfile | undefined =
    state.profiles.find((x) => x.id === state.activeId) ?? state.profiles[0]
  if (!ready || !p) return <div className="settings-empty">载入声音档案…</div>

  const pickAudio = async (): Promise<void> => {
    const path = await window.chion.pickAudioFile()
    if (path) updateProfile(p.id, { refAudioPath: path })
  }

  return (
    <>
      <p className="settings-hint">
        声音档案对标 AI 档案，多档案可切换。本地引擎需先启动 SoVITS 服务（双击 <kbd>启动全部.bat</kbd>）。
      </p>
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
          + 新声音
        </button>
      </div>
      <Field label="名称" value={p.name} onChange={(v) => updateProfile(p.id, { name: v })} />
      <Field label="baseURL" value={p.baseURL} onChange={(v) => updateProfile(p.id, { baseURL: v })} />
      <div className="settings-field">
        <label>参考音频路径（服务端可达绝对路径）</label>
        <input
          type="text"
          value={p.refAudioPath ?? ''}
          onChange={(e) => updateProfile(p.id, { refAudioPath: e.target.value })}
        />
        <Button variant="outline" size="sm" onClick={pickAudio}>
          选择音频文件…
        </Button>
      </div>
      <Field
        label="参考音频文本（prompt_text）"
        value={p.promptText ?? ''}
        onChange={(v) => updateProfile(p.id, { promptText: v })}
      />
      <div className="settings-field">
        <label>语速（speed_factor）</label>
        <input
          type="number"
          step="0.1"
          min="0.1"
          value={String(p.speedFactor ?? 1.0)}
          onChange={(e) => {
            // 空串/NaN/<=0 一律回落 1.0：speed 0 会让 SoVITS 合成卡死不出声。
            const v = Number(e.target.value)
            updateProfile(p.id, { speedFactor: Number.isFinite(v) && v > 0 ? v : 1.0 })
          }}
        />
      </div>
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
