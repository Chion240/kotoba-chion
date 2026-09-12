import type { Token } from '../../../../worker/contract'
import { furiganaFor } from './ruby'

// 日文正文：分词到达后渲染成一串可点 token（每个含汉字者带振假名 ruby）；
// 未到达时降级为纯文本（不阻塞阅读，总纲第 5 节兜底）。
// interaction 会话在此挂点词/选择 —— 故每个 token 是独立可定位单元，
// data-seq/data-idx 留作选择锚点，onTokenClick 先留接口（本会话不实现剪贴板）。
export type TokenClick = (seq: number, tokenIdx: number, token: Token) => void

export function JapaneseText({
  seq,
  text,
  tokens,
  showFurigana = true,
  onTokenClick
}: {
  seq: number
  text: string
  tokens: Token[] | undefined
  showFurigana?: boolean // 注音开关（决策 2：可关，默认开）；一律用 Sudachi 读音，弃书自带 seg.ruby
  onTokenClick?: TokenClick
}): React.JSX.Element {
  if (!tokens || tokens.length === 0) {
    // 降级：纯文本（分词未到 / 失败）。仍可读。
    return <span className="reader-jp-plain">{text}</span>
  }
  return (
    <>
      {tokens.map((tk, i) => {
        const furi = showFurigana ? furiganaFor(tk.surface, tk.reading) : null
        return (
          <span
            key={i}
            className="reader-token"
            data-seq={seq}
            data-idx={i}
            onClick={onTokenClick ? () => onTokenClick(seq, i, tk) : undefined}
          >
            {furi ? (
              <ruby>
                {tk.surface}
                <rt>{furi}</rt>
              </ruby>
            ) : (
              tk.surface
            )}
          </span>
        )
      })}
    </>
  )
}
