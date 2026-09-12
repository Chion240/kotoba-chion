import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const pkg = JSON.parse(read('package.json'))
const builder = read('electron-builder.yml')
const main = read('src/main/index.ts')
const release = read('scripts/release-win.mjs')

assert.equal(pkg.productName, 'Kotoba Chion')
assert.equal(pkg.version, '3.0.0')
assert.equal(pkg.private, true)
assert.equal(pkg.license, 'UNLICENSED')
assert.equal(pkg.engines.node, '>=22.12.0')
assert.equal(pkg.devDependencies['electron-builder'], '26.15.3')
assert.equal(pkg.devDependencies['@electron/rebuild'], '4.2.0')

assert.match(builder, /^appId: com\.chion240\.kotobachion$/m)
assert.match(builder, /app: \.release-app/)
assert.match(builder, /target: nsis/)
assert.match(builder, /target: zip/)
assert.match(builder, /oneClick: false/)
assert.match(builder, /perMachine: false/)
assert.match(builder, /allowToChangeInstallationDirectory: true/)
assert.match(builder, /deleteAppDataOnUninstall: false/)
assert.match(builder, /node_modules\/better-sqlite3\/build\/Release\/better_sqlite3\.node/)
assert.match(builder, /out\/renderer\/sudachi\/\*\*\/\*/)
assert.match(builder, /!node_modules\/sudachi-wasm333\/resources/)
assert.match(builder, /!node_modules\/\*\*\/\*\.\{ts,tsx,map\}/)
assert.match(builder, /!node_modules\/\*\*\/\{test,tests,__tests__,spec,specs/)
assert.match(builder, /!node_modules\/better-sqlite3\/src/)
assert.match(builder, /!node_modules\/better-sqlite3\/deps/)

assert.match(main, /USER_DATA_DIR_NAME = 'kotoba-chion'/)
assert.match(main, /app\.setPath\('userData', stableUserDataPath\)/)
assert.match(main, /app\.requestSingleInstanceLock\(\)/)
assert.match(main, /app\.on\('second-instance'/)

assert.match(release, /CSC_IDENTITY_AUTO_DISCOVERY: 'false'/)
assert.match(release, /目标已存在，不会覆盖/)
assert.match(release, /cpSync\(join\(repoRoot, 'out'\)/)
assert.match(release, /'better-sqlite3': pkg\.dependencies\['better-sqlite3'\]/)
assert.match(release, /'electron-store': pkg\.dependencies\['electron-store'\]/)
assert.match(release, /SHA256SUMS\.txt/)

assert.ok(statSync(resolve(root, 'build/icon.png')).size > 5_000)
assert.ok(statSync(resolve(root, 'build/icon.ico')).size > 10_000)
assert.match(read('LICENSE'), /最终用户许可协议/)
assert.match(read('THIRD_PARTY_NOTICES.txt'), /Apache License/)
assert.match(read('build/RELEASE-NOTES.md'), /SmartScreen/)

console.log('OK: release 配置全绿（产品身份/双产物/免管理员/数据保留/许可/图标/防覆盖/校验）')
