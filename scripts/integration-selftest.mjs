import { readFileSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const dir = resolve(root, 'src/main/modules/integration-store')
const out = join(dir, '__selftest_index.mjs')
const cwd = mkdtempSync(join(tmpdir(), 'chion-integration-'))
const executable = join(cwd, 'GoldenDict.exe')

let ok = false
try {
  let js = ts.transpileModule(readFileSync(join(dir, 'index.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText
  js = js
    .replace(/import\s*\{[^}]*\}\s*from\s*'electron'\s*;?/, '')
    .replace(/import\s*\{\s*IPC_CHANNELS\s*\}\s*from\s*'\.\.\/\.\.\/\.\.\/shared\/ipc'\s*;?/, '')
  writeFileSync(out, js)
  writeFileSync(executable, '')

  const {
    DEFAULT_INTEGRATION_SETTINGS,
    coerceIntegrationSettings,
    validateDictionaryAppPath,
    openDictionaryApp,
    openIntegrationStore
  } = await import('file://' + out.replace(/\\/g, '/'))

  assert.deepStrictEqual(
    coerceIntegrationSettings({}),
    DEFAULT_INTEGRATION_SETTINGS,
    '旧数据补默认：自动启动关闭且路径为空'
  )
  assert.deepStrictEqual(
    coerceIntegrationSettings({ autoLaunchDictionaryApp: true, dictionaryAppPath: executable }),
    { autoLaunchDictionaryApp: true, dictionaryAppPath: executable },
    '合法设置保留'
  )
  assert.match(validateDictionaryAppPath('relative.exe'), /绝对路径/, '拒绝相对路径')
  assert.match(validateDictionaryAppPath(join(cwd, 'tool.bat')), /exe.*lnk/i, '拒绝脚本文件')
  assert.match(validateDictionaryAppPath(join(cwd, 'missing.exe')), /不存在/, '拒绝不存在的路径')
  assert.strictEqual(validateDictionaryAppPath(executable), '', '接受存在的绝对 exe 路径')

  let opened = ''
  assert.strictEqual(
    await openDictionaryApp(executable, async (path) => {
      opened = path
      return ''
    }),
    '',
    'shell.openPath 空串表示成功'
  )
  assert.strictEqual(opened, executable, '只把验证后的原始路径交给 opener')
  assert.match(
    await openDictionaryApp(executable, async () => 'access denied'),
    /access denied/,
    '启动器错误原样返回给设置界面'
  )

  const store = openIntegrationStore(cwd)
  assert.deepStrictEqual(store.getSettings(), DEFAULT_INTEGRATION_SETTINGS, '持久化初始默认')
  assert.strictEqual(store.getLastLaunchError(), '', '首次启动没有遗留错误')
  const saved = { autoLaunchDictionaryApp: true, dictionaryAppPath: executable }
  store.saveSettings(saved)
  store.setLastLaunchError('path missing')
  assert.deepStrictEqual(openIntegrationStore(cwd).getSettings(), saved, 'electron-store 往返一致')
  assert.strictEqual(
    openIntegrationStore(cwd).getLastLaunchError(),
    'path missing',
    '自动启动错误持久化供设置界面提示'
  )
  store.saveSettings(DEFAULT_INTEGRATION_SETTINGS)
  assert.strictEqual(store.getLastLaunchError(), '', '更换或清除设置时清掉旧启动错误')

  ok = true
  console.log('OK: integration 全绿（默认/校验/安全打开/electron-store 往返）')
} finally {
  rmSync(out, { force: true })
  rmSync(cwd, { recursive: true, force: true })
}
if (!ok) process.exit(1)
