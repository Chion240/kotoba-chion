import { createHash } from 'node:crypto'
import {
  copyFileSync,
  cpSync,
  createReadStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
const version = pkg.version
const releaseName = `Kotoba-Chion-${version}`
const stagingDir = join(repoRoot, 'release-build')
const packageAppDir = join(repoRoot, '.release-app')

function fail(message) {
  console.error(`发行失败：${message}`)
  process.exit(1)
}

function outputArgument() {
  const i = process.argv.indexOf('--output')
  if (i < 0 || !process.argv[i + 1]) fail('必须提供 --output <绝对目录>')
  if (!isAbsolute(process.argv[i + 1])) fail('--output 必须是绝对路径')
  return resolve(process.argv[i + 1])
}

function run(command, args, extraEnv = {}) {
  console.log(`\n> ${command} ${args.join(' ')}`)
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv }
  })
  if (result.status !== 0) fail(`${command} 退出码 ${String(result.status)}`)
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32'
  })
  if (result.status !== 0) return 'unknown'
  return result.stdout.trim()
}

async function sha256(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

if (process.platform !== 'win32' || process.arch !== 'x64') {
  fail(`只支持 Windows x64 构建机，当前为 ${process.platform}/${process.arch}`)
}

const outputRoot = outputArgument()
const finalDir = join(outputRoot, releaseName)
if (existsSync(finalDir)) fail(`目标已存在，不会覆盖：${finalDir}`)

const dictionary = join(repoRoot, 'src', 'renderer', 'public', 'sudachi', 'system.dic')
if (!existsSync(dictionary) || statSync(dictionary).size < 100 * 1024 * 1024) {
  fail('Sudachi 词典缺失或不完整，请先运行 npm run setup:dict')
}
if (!existsSync(join(repoRoot, 'build', 'icon.ico'))) {
  fail('build/icon.ico 不存在，请先生成发行图标')
}

const resolvedStaging = resolve(stagingDir)
if (!resolvedStaging.startsWith(resolve(repoRoot) + sep)) fail('内部暂存目录越出仓库')
rmSync(resolvedStaging, { recursive: true, force: true })
const resolvedPackageApp = resolve(packageAppDir)
if (!resolvedPackageApp.startsWith(resolve(repoRoot) + sep)) fail('应用暂存目录越出仓库')
rmSync(resolvedPackageApp, { recursive: true, force: true })

run('npm', ['run', 'rebuild'])
run('npm', ['run', 'typecheck'])
for (const test of [
  'smoke',
  'test:storage',
  'test:tokenizer',
  'test:epub',
  'test:reader',
  'test:interaction',
  'test:library',
  'test:library-integ',
  'test:progress',
  'test:ai',
  'test:ai-translation',
  'test:settings',
  'test:settings-store',
  'test:integration',
  'test:tts',
  'test:ipc',
  'test:release'
]) {
  run('npm', ['run', test])
}
run('npm', ['run', 'build'])

// electron-builder 只扫描这个白名单目录，既阻止源码/样书混入，也规避仓库根部与应用无关的
// 异常文件名。依赖仍从父目录 node_modules 解析，最终只复制 package.json 声明的生产依赖。
mkdirSync(join(packageAppDir, 'build'), { recursive: true })
cpSync(join(repoRoot, 'out'), join(packageAppDir, 'out'), { recursive: true })
const runtimePackage = {
  name: pkg.name,
  productName: pkg.productName,
  version: pkg.version,
  description: pkg.description,
  author: pkg.author,
  private: true,
  license: pkg.license,
  main: pkg.main,
  type: pkg.type,
  dependencies: {
    'better-sqlite3': pkg.dependencies['better-sqlite3'],
    'electron-store': pkg.dependencies['electron-store']
  },
  devDependencies: { electron: pkg.devDependencies.electron }
}
writeFileSync(join(packageAppDir, 'package.json'), `${JSON.stringify(runtimePackage, null, 2)}\n`, 'utf8')
copyFileSync(join(repoRoot, 'LICENSE'), join(packageAppDir, 'LICENSE'))
copyFileSync(join(repoRoot, 'THIRD_PARTY_NOTICES.txt'), join(packageAppDir, 'THIRD_PARTY_NOTICES.txt'))
copyFileSync(join(repoRoot, 'build', 'icon.ico'), join(packageAppDir, 'build', 'icon.ico'))
run(
  join(repoRoot, 'node_modules', '.bin', 'electron-builder.cmd'),
  ['--win', 'nsis', 'zip', '--x64', '--publish', 'never'],
  { CSC_IDENTITY_AUTO_DISCOVERY: 'false' }
)

run('node', [
  join(repoRoot, 'scripts', 'package-layout-selftest.mjs'),
  join(stagingDir, 'win-unpacked')
])

run(
  join(repoRoot, 'node_modules', 'electron', 'dist', 'electron.exe'),
  [
    join(repoRoot, 'scripts', 'package-native-selftest.cjs'),
    join(stagingDir, 'win-unpacked', 'resources', 'app.asar', 'node_modules', 'better-sqlite3')
  ],
  { ELECTRON_RUN_AS_NODE: '1' }
)

const installerName = `Kotoba-Chion-Setup-${version}-x64.exe`
const portableName = `Kotoba-Chion-Portable-${version}-x64.zip`
for (const name of [installerName, portableName]) {
  const path = join(stagingDir, name)
  if (!existsSync(path) || statSync(path).size < 1024 * 1024) fail(`打包产物缺失或异常：${name}`)
}

mkdirSync(outputRoot, { recursive: true })
const tempDir = mkdtempSync(join(outputRoot, '.kotoba-release-'))
try {
  copyFileSync(join(stagingDir, installerName), join(tempDir, installerName))
  copyFileSync(join(stagingDir, portableName), join(tempDir, portableName))
  copyFileSync(join(repoRoot, 'LICENSE'), join(tempDir, 'EULA.txt'))
  copyFileSync(join(repoRoot, 'THIRD_PARTY_NOTICES.txt'), join(tempDir, 'THIRD_PARTY_NOTICES.txt'))
  const releaseNotesName = `RELEASE-NOTES-${version}.md`
  copyFileSync(join(repoRoot, 'build', 'RELEASE-NOTES.md'), join(tempDir, releaseNotesName))

  const electronVersion = JSON.parse(
    readFileSync(join(repoRoot, 'node_modules', 'electron', 'package.json'), 'utf8')
  ).version
  const commit = capture('git', ['rev-parse', 'HEAD'])
  const trackedChanges = capture('git', ['status', '--porcelain', '--untracked-files=no'])
  const buildInfo = [
    'Product: Kotoba Chion',
    `Version: ${version}`,
    'Platform: Windows x64',
    `BuiltAtUtc: ${new Date().toISOString()}`,
    `GitCommit: ${commit}`,
    `TrackedWorktreeDirty: ${trackedChanges ? 'yes' : 'no'}`,
    `Node: ${process.version}`,
    `Electron: ${electronVersion}`,
    'Signing: unsigned',
    ''
  ].join('\r\n')
  writeFileSync(join(tempDir, 'BUILD-INFO.txt'), buildInfo, 'utf8')

  const hashTargets = readdirSync(tempDir).sort()
  const hashLines = []
  for (const name of hashTargets) hashLines.push(`${await sha256(join(tempDir, name))}  ${name}`)
  writeFileSync(join(tempDir, 'SHA256SUMS.txt'), `${hashLines.join('\r\n')}\r\n`, 'utf8')

  renameSync(tempDir, finalDir)
  console.log(`\n发行完成：${finalDir}`)
  for (const name of readdirSync(finalDir).sort()) console.log(`  ${name}`)
} catch (error) {
  rmSync(tempDir, { recursive: true, force: true })
  throw error
}
