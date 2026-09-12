/// <reference lib="webworker" />
// tokenizer 会话（第 2 批）：Worker 外壳。会话 1 的 echo stub 换成真分词。
//
// 职责：懒加载官方 SudachiDict（首个请求触发，或收到 config 提前触发），
// 词典字节交给纯核心（sudachi.ts）建 tokenizer；A/B/C 分词、映射契约 Token。
// 词典大（~200MB），加载走 fetch + 一次性建库，全程在此后台线程 —— 主/渲染线程永不跑
// Sudachi（总纲第 4、7 节）。加载期间到达的请求排队，就绪后按序回。
import type { TokenizeReq, TokenizeRes } from './contract'
import { createTokenizer, type SudachiTokenizer } from './sudachi'

// 词典 URL：默认约定放渲染进程 public 下 /sudachi/system.dic（dev 由 Vite 服务）。
// 生产打包后页面走 file://，根绝对路径会解析到盘符根 → 404（会话 5 留的债，此处还清）：
// 产物布局固定为 renderer/assets/worker.js 与 renderer/sudachi/system.dic，
// 故 file: 协议下用相对本 worker 脚本的 ../sudachi/system.dic 定位。
// 仍可被 config 消息覆盖（保留注入口）。
let dictUrl =
  self.location.protocol === 'file:'
    ? new URL('../sudachi/system.dic', self.location.href).href
    : '/sudachi/system.dic'

// config 消息：仅覆盖词典 URL；须在首次分词前发。带 text 的是 TokenizeReq。
type ConfigMsg = { type: 'config'; dictUrl: string }
type Inbound = TokenizeReq | ConfigMsg

let tokenizer: SudachiTokenizer | null = null
let loading: Promise<SudachiTokenizer> | null = null

// 词典加载失败上报给客户端（reader-view 顶部横幅显示根因，供无法开 F12 的场景）。
type DictErrorMsg = { type: 'dict-error'; reason: string }
// 诊断日志上报（Worker console 不进主进程 stdout，故经 postMessage 让客户端转发）。
type DiagMsg = { type: 'diag'; line: string }

function diag(line: string): void {
  console.log('[tokenizer]', line)
  const msg: DiagMsg = { type: 'diag', line }
  self.postMessage(msg)
}

async function ensureTokenizer(): Promise<SudachiTokenizer> {
  if (tokenizer) return tokenizer
  if (!loading) {
    loading = (async () => {
      const t0 = Date.now()
      diag(`开始加载词典 fetch: ${dictUrl}`)
      const res = await fetch(dictUrl)
      diag(`fetch 返回 status=${res.status} ok=${res.ok} (${Date.now() - t0}ms)`)
      if (!res.ok) throw new Error(`词典加载失败 HTTP ${res.status} @ ${dictUrl}`)
      const buf = await res.arrayBuffer()
      diag(`词典字节数=${buf.byteLength} (${Date.now() - t0}ms)`)
      const bytes = new Uint8Array(buf)
      diag('createTokenizer 开始（WASM initialize_from_bytes）…')
      tokenizer = createTokenizer(bytes)
      diag(`createTokenizer 成功 ✓ (总 ${Date.now() - t0}ms)`)
      return tokenizer
    })()
    // 加载失败时上报根因（并清 loading 允许重试）。
    loading.catch((err) => {
      loading = null
      const reason = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      console.error('[tokenizer] 词典加载失败:', err)
      const msg: DictErrorMsg = { type: 'dict-error', reason }
      self.postMessage(msg)
    })
  }
  return loading
}

self.onmessage = (e: MessageEvent<Inbound>) => {
  const msg = e.data
  if ('type' in msg && msg.type === 'config') {
    dictUrl = msg.dictUrl
    return
  }
  const req = msg as TokenizeReq
  // 每条请求独立 await；加载中的请求自然排在同一个 loading Promise 后，就绪即按序回。
  ensureTokenizer()
    .then((tk) => {
      const res: TokenizeRes = { seq: req.seq, tokens: tk.tokenize(req.text, req.mode) }
      self.postMessage(res)
    })
    .catch((err) => {
      // 分词失败不阻塞阅读：回空 tokens，reader-view 降级为纯文本显示。
      console.error('[tokenizer] 分词失败 seq=%d: %o', req.seq, err)
      const res: TokenizeRes = { seq: req.seq, tokens: [] }
      self.postMessage(res)
    })
}
