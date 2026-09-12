import assert from 'node:assert/strict'
import { existsSync, statSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { extractFile, listPackage } from '@electron/asar'

const appDir = resolve(process.argv[2] ?? '')
assert.ok(process.argv[2] && isAbsolute(appDir), '必须传入发行版 win-unpacked 绝对路径')

const resources = join(appDir, 'resources')
const archive = join(resources, 'app.asar')
assert.ok(existsSync(archive), '发行包缺少 app.asar')
const entries = listPackage(archive).map((entry) => entry.replaceAll('\\', '/').toLowerCase())
const forbidden = entries.filter(
  (entry) =>
    /^\/(src|scripts|docs|参考)\//.test(entry) ||
    /\.(epub|log|ts|tsx|map)$/.test(entry) ||
    entry.includes('/node_modules/sudachi-wasm333/resources/') ||
    /\/node_modules\/.*\/(test|tests|__tests__|spec|specs|example|examples|benchmark|benchmarks)\//.test(
      entry
    ) ||
    /\/node_modules\/.*\/test[^/]*\.js$/.test(entry) ||
    /\/node_modules\/.*\.(test|spec)\.js$/.test(entry) ||
    /\/node_modules\/better-sqlite3\/(src|deps)\//.test(entry) ||
    /\/node_modules\/better-sqlite3\/build\/release\/(?!better_sqlite3\.node$)/.test(entry) ||
    /\.(c|cc|cpp|h|hpp|gyp|gypi|sln|vcxproj|filters|obj|lib|exp|iobj|ipdb|pdb|tlog|recipe|lastbuildstate)$/.test(
      entry
    )
)
assert.deepEqual(forbidden, [], `发行包混入禁止文件：\n${forbidden.join('\n')}`)

const packageJson = JSON.parse(extractFile(archive, 'package.json').toString('utf8'))
assert.deepEqual(Object.keys(packageJson.dependencies).sort(), ['better-sqlite3', 'electron-store'])
assert.equal(packageJson.main, 'out/main/index.js')

const dictionary = join(resources, 'app.asar.unpacked', 'out', 'renderer', 'sudachi', 'system.dic')
const nativeModule = join(
  resources,
  'app.asar.unpacked',
  'node_modules',
  'better-sqlite3',
  'build',
  'Release',
  'better_sqlite3.node'
)
assert.ok(statSync(dictionary).size > 100 * 1024 * 1024, '发行包 Sudachi 词典缺失或不完整')
assert.ok(statSync(nativeModule).size > 1024 * 1024, '发行包 better-sqlite3 原生模块缺失')
for (const file of ['EULA.txt', 'THIRD_PARTY_NOTICES.txt']) {
  assert.ok(statSync(join(resources, file)).size > 1000, `发行包缺少 ${file}`)
}

console.log(
  'OK: 发行包布局全绿（无源码/测试/构建中间文件/样书/日志/冗余词典，许可与运行资源齐全）'
)
