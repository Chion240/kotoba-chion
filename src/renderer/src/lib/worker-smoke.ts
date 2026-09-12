import type { TokenizeReq, TokenizeRes } from '../../../worker/contract'

// 脚手架烟测：启动一个 Web Worker，发一条 TokenizeReq，收回声即证明
// renderer→worker→renderer 这条管子通。非业务——tokenizer 会话会替换 stub 逻辑。
export function runWorkerSmoke(): Promise<TokenizeRes> {
  return new Promise((resolve) => {
    const worker = new Worker(
      new URL('../../../worker/tokenizer.worker.ts', import.meta.url),
      { type: 'module' }
    )
    worker.onmessage = (e: MessageEvent<TokenizeRes>) => {
      resolve(e.data)
      worker.terminate()
    }
    const req: TokenizeReq = { seq: 0, text: 'テスト', mode: 'C' }
    worker.postMessage(req)
  })
}
