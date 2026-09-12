// epub-import · 最小 ZIP 读取器（stdlib zlib，零新依赖）。
// EPUB = ZIP，条目只用 stored(0) 或 deflate(8)。
// ponytail: 不支持 zip64 / 加密（EPUB 规范不用）；真出现超 4GB 书再升级。
import { inflateRawSync } from 'node:zlib'

const EOCD_SIG = 0x06054b50 // End Of Central Directory
const CEN_SIG = 0x02014b50 // Central directory entry
const LOC_SIG = 0x04034b50 // Local file header

type Entry = { method: number; localOffset: number; compSize: number }

export type Zip = {
  names: string[]
  has(name: string): boolean
  read(name: string): Buffer // 解压后的原始字节
  readText(name: string): string // 按 UTF-8 解码
}

// 从尾部回扫定位 EOCD（末尾可能带注释，最多 64KB）。
function findEocd(buf: Buffer): number {
  const min = Math.max(0, buf.length - 0x10000 - 22)
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i
  }
  throw new Error('不是有效的 ZIP/EPUB：找不到 EOCD')
}

// 解析中央目录，建 name → entry 映射。
function readCentralDir(buf: Buffer): Map<string, Entry> {
  const eocd = findEocd(buf)
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16) // 中央目录起始偏移
  const map = new Map<string, Entry>()
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== CEN_SIG) throw new Error('中央目录条目签名损坏')
    const method = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const localOffset = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    map.set(name, { method, localOffset, compSize })
    p += 46 + nameLen + extraLen + commentLen
  }
  return map
}

// 从本地文件头取真实数据起点（本地头的 name/extra 长度可能与中央目录不同）。
function extract(buf: Buffer, e: Entry): Buffer {
  const o = e.localOffset
  if (buf.readUInt32LE(o) !== LOC_SIG) throw new Error('本地文件头签名损坏')
  const nameLen = buf.readUInt16LE(o + 26)
  const extraLen = buf.readUInt16LE(o + 28)
  const start = o + 30 + nameLen + extraLen
  const comp = buf.subarray(start, start + e.compSize)
  if (e.method === 0) return Buffer.from(comp) // stored
  if (e.method === 8) return inflateRawSync(comp) // deflate
  throw new Error(`不支持的压缩方式 ${e.method}`)
}

export function openZip(buf: Buffer): Zip {
  const dir = readCentralDir(buf)
  return {
    names: [...dir.keys()],
    has: (name) => dir.has(name),
    read(name) {
      const e = dir.get(name)
      if (!e) throw new Error(`ZIP 内找不到条目：${name}`)
      return extract(buf, e)
    },
    readText(name) {
      return this.read(name).toString('utf8')
    }
  }
}
