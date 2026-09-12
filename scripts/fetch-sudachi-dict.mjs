// tokenizer 会话（第 2 批）：下载官方 SudachiDict 到渲染进程 public 下。
// 跑：npm run setup:dict
//
// 为什么单独下载：sudachi-wasm333 自带的 resources/system.dic 是残缺词典
// （无 C-unit 切分数据、误分词），A/B/C 模式无法区分。官方 SudachiDict 才有完整数据。
// 词典 ~200MB，不入 git（见 .gitignore），装机时下载到 public/sudachi/system.dic，
// dev 由 Vite 从 / 服务，worker fetch('/sudachi/system.dic') 加载。
import { createWriteStream } from 'node:fs'
import { mkdir, rm, readdir, rename, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const outDir = resolve(root, 'src/renderer/public/sudachi')
const outDic = join(outDir, 'system.dic')

// 官方 SudachiDict core（含 A/B/C 三级切分数据）。full 更全但 ~250MB，core 够阅读用。
const DICT_ZIP =
  'http://sudachi.s3-website-ap-northeast-1.amazonaws.com/sudachidict/sudachi-dictionary-20250515-core.zip'

// 已存在且够大就跳过（避免重复下载 200MB）。
try {
  const s = await stat(outDic)
  if (s.size > 100 * 1024 * 1024) {
    console.log(`词典已就位（${Math.round(s.size / 1024 / 1024)}MB）@ ${outDic}，跳过下载。`)
    process.exit(0)
  }
} catch {
  // 不存在，继续下载
}

await mkdir(outDir, { recursive: true })
const zipPath = join(outDir, '_dict.zip')

console.log(`下载官方 SudachiDict core…\n  ${DICT_ZIP}`)
const res = await fetch(DICT_ZIP)
if (!res.ok || !res.body) throw new Error(`下载失败 ${res.status}`)
await pipeline(Readable.fromWeb(res.body), createWriteStream(zipPath))
console.log(`  已下载 ${Math.round((await stat(zipPath)).size / 1024 / 1024)}MB，解压中…`)

// tar 在 Win10+/macOS/Linux 均内置，可解 zip，零依赖。
const tar = spawnSync('tar', ['-xf', zipPath, '-C', outDir], { stdio: 'inherit' })
if (tar.status !== 0) throw new Error('解压失败（tar）')

// 压缩包内是 sudachi-dictionary-YYYYMMDD/system_core.dic，扒出来重命名为 system.dic。
const entries = await readdir(outDir, { withFileTypes: true })
const subDir = entries.find((e) => e.isDirectory() && e.name.startsWith('sudachi-dictionary'))
if (!subDir) throw new Error('解压后未找到 sudachi-dictionary 目录')
const extractedDic = join(outDir, subDir.name, 'system_core.dic')
await rename(extractedDic, outDic)

// 清理中间物。
await rm(zipPath, { force: true })
await rm(join(outDir, subDir.name), { recursive: true, force: true })

console.log(`词典就位（${Math.round((await stat(outDic)).size / 1024 / 1024)}MB）@ ${outDic}`)
