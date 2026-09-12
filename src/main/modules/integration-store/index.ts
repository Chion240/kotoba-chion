import Store from 'electron-store'
import { dialog, ipcMain, shell } from 'electron'
import { existsSync, statSync } from 'node:fs'
import { extname, isAbsolute } from 'node:path'
import { IPC_CHANNELS } from '../../../shared/ipc'
import type { IntegrationSettings } from '../../../shared/contracts'
export type { IntegrationSettings } from '../../../shared/contracts'

export const DEFAULT_INTEGRATION_SETTINGS: IntegrationSettings = {
  autoLaunchDictionaryApp: false,
  dictionaryAppPath: ''
}

export function coerceIntegrationSettings(raw: unknown): IntegrationSettings {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    autoLaunchDictionaryApp:
      typeof value.autoLaunchDictionaryApp === 'boolean'
        ? value.autoLaunchDictionaryApp
        : false,
    dictionaryAppPath:
      typeof value.dictionaryAppPath === 'string'
        ? value.dictionaryAppPath.trim().slice(0, 2048)
        : ''
  }
}

type Schema = { settings: IntegrationSettings; lastLaunchError: string }

export function openIntegrationStore(cwd?: string) {
  const store = new Store<Schema>({
    name: 'integration-settings',
    defaults: { settings: DEFAULT_INTEGRATION_SETTINGS, lastLaunchError: '' },
    ...(cwd ? { cwd } : {})
  })
  return {
    getSettings(): IntegrationSettings {
      return coerceIntegrationSettings(store.get('settings'))
    },
    saveSettings(settings: IntegrationSettings): void {
      store.set('settings', coerceIntegrationSettings(settings))
      store.set('lastLaunchError', '')
    },
    getLastLaunchError(): string {
      const value = store.get('lastLaunchError')
      return typeof value === 'string' ? value : ''
    },
    setLastLaunchError(error: string): void {
      store.set('lastLaunchError', error.slice(0, 2048))
    }
  }
}

export type IntegrationStore = ReturnType<typeof openIntegrationStore>

export function validateDictionaryAppPath(path: string): string {
  const target = path.trim()
  if (!target) return '请先选择查词软件'
  if (!isAbsolute(target)) return '查词软件必须使用绝对路径'
  if (!['.exe', '.lnk'].includes(extname(target).toLowerCase())) {
    return '仅支持 .exe 或 .lnk 软件路径'
  }
  if (!existsSync(target)) return '查词软件路径不存在'
  try {
    if (!statSync(target).isFile()) return '查词软件路径不是文件'
  } catch {
    return '无法读取查词软件路径'
  }
  return ''
}

export async function openDictionaryApp(
  path: string,
  opener: (target: string) => Promise<string> = shell.openPath
): Promise<string> {
  const invalid = validateDictionaryAppPath(path)
  if (invalid) return invalid
  try {
    return await opener(path.trim())
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

export function registerIntegrationIpc(store: IntegrationStore): void {
  ipcMain.handle(IPC_CHANNELS.integration.getSettings, () => store.getSettings())
  ipcMain.handle(IPC_CHANNELS.integration.getLastLaunchError, () => store.getLastLaunchError())
  ipcMain.handle(IPC_CHANNELS.integration.saveSettings, (_event, settings: IntegrationSettings) => {
    store.saveSettings(settings)
  })
  ipcMain.handle(IPC_CHANNELS.integration.pickDictionaryApp, async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      title: '选择查词软件',
      properties: ['openFile'],
      filters: [{ name: '应用程序', extensions: ['exe', 'lnk'] }]
    })
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
  })
  ipcMain.handle(IPC_CHANNELS.integration.launchDictionaryApp, (_event, path: string) =>
    openDictionaryApp(path)
  )
}
