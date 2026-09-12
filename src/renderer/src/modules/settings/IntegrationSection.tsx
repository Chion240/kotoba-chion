import { useEffect, useState } from 'react'
import type { IntegrationSettings } from '../../../../shared/contracts'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

const EMPTY: IntegrationSettings = {
  autoLaunchDictionaryApp: false,
  dictionaryAppPath: ''
}

export function IntegrationSection(): React.JSX.Element {
  const [settings, setSettings] = useState<IntegrationSettings>(EMPTY)
  const [ready, setReady] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    let alive = true
    void Promise.all([
      window.chion.getIntegrationSettings(),
      window.chion.getDictionaryLaunchError()
    ]).then(([loaded, launchError]) => {
      if (!alive) return
      setSettings(loaded)
      setStatus(launchError ? `自动打开失败：${launchError}` : '')
      setReady(true)
    })
    return () => {
      alive = false
    }
  }, [])

  const persist = (next: IntegrationSettings): void => {
    setSettings(next)
    setStatus('')
    void window.chion.saveIntegrationSettings(next)
  }

  const pick = async (): Promise<void> => {
    const path = await window.chion.pickDictionaryApp()
    if (!path) return
    persist({ autoLaunchDictionaryApp: true, dictionaryAppPath: path })
  }

  const testOpen = async (): Promise<void> => {
    const error = await window.chion.launchDictionaryApp(settings.dictionaryAppPath)
    setStatus(error ? `打开失败：${error}` : '查词软件已打开')
  }

  return (
    <section className="settings-integration">
      <h3 className="settings-section-title">查词软件联动</h3>
      <div className="settings-field settings-key-row">
        <label htmlFor="dictionary-auto-launch">启动阅读器时自动打开</label>
        <Switch
          id="dictionary-auto-launch"
          checked={settings.autoLaunchDictionaryApp}
          disabled={!ready || !settings.dictionaryAppPath}
          onCheckedChange={(checked) =>
            persist({ ...settings, autoLaunchDictionaryApp: checked })
          }
        />
      </div>
      <div className="settings-field">
        <label htmlFor="dictionary-app-path">软件路径</label>
        <input
          id="dictionary-app-path"
          type="text"
          value={settings.dictionaryAppPath}
          placeholder="请选择 .exe 或 .lnk 文件"
          readOnly
        />
      </div>
      <div className="settings-integration-actions">
        <Button variant="outline" size="sm" onClick={() => void pick()} disabled={!ready}>
          选择软件
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void testOpen()}
          disabled={!settings.dictionaryAppPath}
        >
          测试打开
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => persist(EMPTY)}
          disabled={!settings.dictionaryAppPath}
        >
          清除
        </Button>
      </div>
      {status && <div className="settings-hint">{status}</div>}
    </section>
  )
}
