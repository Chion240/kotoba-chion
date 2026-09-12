// settings store DOM 自测：切换词框样式后落 localStorage、更新根节点，模块重载后恢复。
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import assert from 'node:assert'
import ts from 'typescript'

const here = dirname(fileURLToPath(import.meta.url))
const dir = resolve(here, '../src/renderer/src/modules/settings')
const tmpMods = []

function transpile(name, suffix = '') {
  const src = readFileSync(join(dir, name + '.ts'), 'utf8')
  let js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  }).outputText
  js = js.replace("from './settings-logic'", `from './__selftest_settings-logic${suffix}.mjs'`)
  js = js.replace("from 'react'", "from './__selftest_react.mjs'")
  const out = join(dir, `__selftest_${name}${suffix}.mjs`)
  writeFileSync(out, js)
  tmpMods.push(out)
  return out
}

const values = new Map()
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value)
}
const styles = new Map()
globalThis.document = {
  documentElement: {
    dataset: {},
    style: {
      setProperty: (key, value) => styles.set(key, value),
      removeProperty: (key) => styles.delete(key)
    },
    classList: { toggle: () => {} }
  }
}

const reactStub = join(dir, '__selftest_react.mjs')
writeFileSync(reactStub, 'export const useSyncExternalStore = () => null\n')
tmpMods.push(reactStub)

const toUrl = (path) => 'file://' + path.replace(/\\/g, '/')

try {
  transpile('settings-logic')
  const firstStore = transpile('settings-store')
  const first = await import(toUrl(firstStore))
  first.applySettings(first.getSettings())
  assert.strictEqual(document.documentElement.dataset.tokenStyle, 'capsule-soft', '首次加载应用默认样式')

  first.setSetting('tokenStyle', 'underline')
  assert.strictEqual(document.documentElement.dataset.tokenStyle, 'underline', '切换立即更新根节点')
  assert.strictEqual(JSON.parse(values.get('chion-settings')).tokenStyle, 'underline', '切换写入 localStorage')

  transpile('settings-logic', '-reload')
  const reloadedStore = transpile('settings-store', '-reload')
  const reloaded = await import(toUrl(reloadedStore))
  assert.strictEqual(reloaded.getSettings().tokenStyle, 'underline', '模块重载从 localStorage 恢复')
  reloaded.applySettings(reloaded.getSettings())
  assert.strictEqual(document.documentElement.dataset.tokenStyle, 'underline', '重载后恢复根节点样式')

  console.log('OK: settings store 词框样式切换/落库/重载恢复全绿')
} finally {
  for (const file of tmpMods) rmSync(file, { force: true })
}
