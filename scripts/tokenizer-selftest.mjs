// tokenizer 会话自测（铁律 4，不依赖其他模块）。跑：npm run test:tokenizer
//
// 用纯核心 sudachi.ts 直接分词（词典字节从 public/sudachi/system.dic 读，即真实运行所用词典），
// 断言：① 三字段 surface/dictionaryForm/reading 对活用词与汉字词正确；
//       ② A/B/C 模式确实产生不同切分（长复合词）；③ 契约字段齐全。
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import assert from 'node:assert'
import { createTokenizer } from '../src/worker/sudachi.ts'

const here = dirname(fileURLToPath(import.meta.url))
const dicPath = resolve(here, '../src/renderer/public/sudachi/system.dic')

let bytes
try {
  bytes = new Uint8Array(await readFile(dicPath))
} catch {
  console.error(`✗ 词典缺失 @ ${dicPath}\n  先跑 npm run setup:dict 下载官方 SudachiDict。`)
  process.exit(1)
}

const tk = createTokenizer(bytes)
let failures = 0
function check(cond, msg) {
  if (cond) {
    console.log(`  ✓ ${msg}`)
  } else {
    console.error(`  ✗ ${msg}`)
    failures++
  }
}
const find = (toks, surface) => toks.find((t) => t.surface === surface)

// ① 活用词还原：「読んでいる」→ 读ん(原形 読む) + いる。原形/读音是点词联动 + 注音命根。
console.log('① 活用词原形 + 读音')
{
  const toks = tk.tokenize('本を読んでいる', 'C')
  const yon = find(toks, '読ん')
  check(!!yon, '「読んでいる」切出表层形「読ん」')
  check(yon?.dictionaryForm === '読む', `「読ん」原形 = 読む（实得 ${yon?.dictionaryForm}）`)
  check(yon?.reading === 'ヨン', `「読ん」读音 = ヨン（实得 ${yon?.reading}）`)
  const hon = find(toks, '本')
  check(hon?.reading === 'ホン', `「本」读音 = ホン（实得 ${hon?.reading}）`)
  check(!!hon?.pos && hon.pos.includes('名詞'), `「本」品词含 名詞（实得 ${hon?.pos}）`)
}

// ② 汉字词原形/读音。
console.log('② 汉字词')
{
  const toks = tk.tokenize('東京都に住んでいます', 'C')
  const sumu = find(toks, '住ん')
  check(sumu?.dictionaryForm === '住む', `「住ん」原形 = 住む（实得 ${sumu?.dictionaryForm}）`)
}

// ③ A/B/C 模式确实不同：长复合词 C 合、A 拆。这是模式可切换的证据。
console.log('③ A/B/C 模式差异')
{
  const a = tk.tokenize('選挙管理委員会', 'A').map((t) => t.surface)
  const c = tk.tokenize('選挙管理委員会', 'C').map((t) => t.surface)
  check(c.length === 1 && c[0] === '選挙管理委員会', `C 模式整合为一词（实得 ${c.join('/')}）`)
  check(a.length > 1, `A 模式拆细（实得 ${a.join('/')}）`)
  check(a.join('/') !== c.join('/'), 'A 与 C 切分不同（模式生效）')
}

// ④ 契约字段齐全：每个 token 四字段都有（surface/dictionaryForm/reading/pos）。
console.log('④ 契约字段完整性')
{
  const toks = tk.tokenize('東京都', 'C')
  const ok = toks.every(
    (t) =>
      typeof t.surface === 'string' &&
      typeof t.dictionaryForm === 'string' &&
      typeof t.reading === 'string' &&
      typeof t.pos === 'string'
  )
  check(ok, '所有 token 具备契约 2 四字段')
  check(toks.length > 0, `非空文本产出 token（实得 ${toks.length} 个）`)
}

// ⑤ 空文本兜底。
console.log('⑤ 边界')
{
  check(tk.tokenize('', 'C').length === 0, '空文本返回空数组')
}

assert(failures === 0, `${failures} 项断言失败`)
console.log('\nOK: tokenizer 自测全绿（原形/读音准确、A/B/C 模式生效、契约字段齐全）')
