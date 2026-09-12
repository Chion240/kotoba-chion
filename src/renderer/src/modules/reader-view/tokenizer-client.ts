import type { Token, TokenizeReq, TokenizeRes } from '../../../../worker/contract'

// reader-view 侧的分词客户端：包一层 tokenizer Worker（契约 2）。
// 职责：起 worker、按 (seq,mode) 去重与缓存、correlation-id 关联请求/响应、
// 生产词典路径覆盖（会话 5 下游债）。视口即时分词全走这里，主线程不碰 Sudachi。
type CacheKey = string // `${seq}:${mode}`
const keyOf = (seq: number, mode: TokenizeReq['mode']): CacheKey => `${seq}:${mode}`

// 缓存上限：无上限的话长书读完全书 tokens 永久驻留（内存只增不减）。
// 2000 条 ≈ 几章的量，重访近章仍秒回；超出按插入序淘汰最旧（近似 LRU，够用）。
const CACHE_MAX = 2000

type ConfigMsg = { type: 'config'; dictUrl: string }
type DictErrorMsg = { type: 'dict-error'; reason: string }
type DiagMsg = { type: 'diag'; line: string }
type Outbound = TokenizeRes | DictErrorMsg | DiagMsg
type QueueItem = { key: CacheKey; text: string; mode: TokenizeReq['mode']; priority: number; order: number }

export class TokenizerClient {
  private worker: Worker
  // 契约 2 的响应只带 seq，无法区分「同 seq 不同 mode / 重发」。
  // 故对 worker 用单调自增的 reqId 当 seq 发出，本地 reqId→真实(seq,mode) 映射还原。
  private nextReqId = 0
  private pending = new Map<number, { key: CacheKey }>()
  private cache = new Map<CacheKey, Token[]>()
  private waiters = new Map<CacheKey, Array<(t: Token[]) => void>>()
  private queue: QueueItem[] = []
  private active = false
  private nextOrder = 0
  // 词典加载失败回调（reader-view 顶部横幅显示根因）。
  private onDictError?: (reason: string) => void

  constructor(onDictError?: (reason: string) => void) {
    this.onDictError = onDictError
    this.worker = new Worker(
      new URL('../../../../worker/tokenizer.worker.ts', import.meta.url),
      { type: 'module' }
    )
    // Worker 加载/运行错误也上报横幅（否则失败静默：无 token、无报错，最难查）。
    this.worker.onerror = (e: ErrorEvent) => {
      const reason = `Worker 错误: ${e.message} @ ${e.filename}:${e.lineno}`
      console.error('[tokenizer]', reason, e.error)
      this.onDictError?.(reason)
    }
    this.worker.onmessage = (e: MessageEvent<Outbound>) => {
      const data = e.data
      if ('type' in data && data.type === 'diag') {
        console.log('[tokenizer]', data.line) // 词典加载生命周期日志（dev devtools 可见）
        return
      }
      if ('type' in data && data.type === 'dict-error') {
        console.error('[tokenizer] 词典加载失败:', data.reason)
        this.onDictError?.(data.reason)
        return
      }
      const p = this.pending.get(data.seq)
      if (!p) return
      this.pending.delete(data.seq)
      this.setCache(p.key, data.tokens)
      const ws = this.waiters.get(p.key)
      if (ws) {
        this.waiters.delete(p.key)
        for (const w of ws) w(data.tokens)
      }
      this.active = false
      this.pump()
    }
  }

  private pump(): void {
    if (this.active || !this.queue.length) return
    this.queue.sort((a, b) => a.priority - b.priority || a.order - b.order)
    const item = this.queue.shift()
    if (!item) return
    const reqId = this.nextReqId++
    this.pending.set(reqId, { key: item.key })
    this.active = true
    const req: TokenizeReq = { seq: reqId, text: item.text, mode: item.mode }
    this.worker.postMessage(req)
  }

  reprioritize(keys: Set<CacheKey>): void {
    for (const item of this.queue) item.priority = keys.has(item.key) ? 0 : 1
    this.pump()
  }

  // 带上限写缓存：超限先淘汰最旧插入项（Map 迭代序 = 插入序）。
  private setCache(key: CacheKey, tokens: Token[]): void {
    if (this.cache.size >= CACHE_MAX) {
      const oldest = this.cache.keys().next().value
      if (oldest !== undefined) this.cache.delete(oldest)
    }
    this.cache.set(key, tokens)
  }

  // 生产打包后 file:// 词典路径失效 —— 起 worker 后发 config 覆盖（会话 5 留的口）。
  configure(dictUrl: string): void {
    const msg: ConfigMsg = { type: 'config', dictUrl }
    this.worker.postMessage(msg)
  }

  // 同步取缓存；命中即返回（视口渲染快路径），未命中返回 undefined。
  peek(seq: number, mode: TokenizeReq['mode']): Token[] | undefined {
    return this.cache.get(keyOf(seq, mode))
  }

  key(seq: number, mode: TokenizeReq['mode']): CacheKey {
    return keyOf(seq, mode)
  }

  // 请求分词：命中缓存直接 resolve；否则发 worker 并等回。重复 (seq,mode) 合并到同一批 waiter。
  tokenize(seq: number, text: string, mode: TokenizeReq['mode'], priority = 0): Promise<Token[]> {
    const key = keyOf(seq, mode)
    const cached = this.cache.get(key)
    if (cached) return Promise.resolve(cached)
    return new Promise<Token[]>((resolve) => {
      const ws = this.waiters.get(key)
      if (ws) {
        ws.push(resolve)
        return // 已在飞行中，搭同一趟
      }
      this.waiters.set(key, [resolve])
      this.queue.push({ key, text, mode, priority, order: this.nextOrder++ })
      this.pump()
    })
  }

  dispose(): void {
    this.worker.terminate()
    this.pending.clear()
    this.waiters.clear()
    this.queue = []
    this.active = false
    this.cache.clear()
  }
}
