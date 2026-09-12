import { memo, useEffect, useState } from 'react'
import type { Segment } from '../../../../shared/contracts'
import type { Token } from '../../../../worker/contract'
import { JapaneseText, type TokenClick } from './JapaneseText'
import { useTranslation } from '../ai-translation'

// 按 type 分发渲染：pair（日文正文，可展开中文）/heading（标题）/image（<img>）。
// 语义色/字体走主题 class（ui-kit 会话），不写死颜色。
export const SegmentView = memo(function SegmentView({
  seg,
  tokens,
  showZh,
  showFurigana = true,
  isSpeaking = false,
  onTokenClick,
  onHover,
  onRetry
}: {
  seg: Segment
  tokens: Token[] | undefined
  showZh: boolean // 该段是否展开译文（t 键或全局开关）
  showFurigana?: boolean // 注音开关（决策 2）
  isSpeaking?: boolean // 连读中当前朗读段高亮（会话 17 Phase 2）
  onTokenClick?: TokenClick
  onHover?: (seq: number | null) => void // 鼠标悬停上报 seq（t 键作用于悬停段，会话 9.1）
  onRetry?: (seg: Segment) => void // AI 译文出错时重试（纯日语书；reader 提供含 profile 的回调，会话 15）
}): React.JSX.Element {
  // AI 译文订阅（会话 15）：内置/已落库 seg.zh_text 优先；否则读 store 的流式态。
  // hook 不可条件调用，故对 image 段也调（image 永不翻译，entry 恒 undefined，无副作用）。
  const ai = useTranslation(seg.id)
  if (seg.type === 'image') return <ImageSegment imageRef={seg.image_ref} />

  const Tag = seg.type === 'heading' ? 'h2' : 'p'
  return (
    <div
      className={isSpeaking ? 'reader-seg is-speaking' : 'reader-seg'}
      data-seq={seg.seq}
      data-type={seg.type}
      onMouseEnter={() => onHover?.(seg.seq)}
      onMouseLeave={() => onHover?.(null)}
    >
      <Tag
        className={
          seg.type === 'heading'
            ? 'reader-heading font-reading-jp'
            : 'reader-pair font-reading-jp'
        }
        lang="ja"
      >
        <JapaneseText
          seq={seg.seq}
          text={seg.jp_text}
          tokens={tokens}
          showFurigana={showFurigana}
          onTokenClick={onTokenClick}
        />
      </Tag>
      {/* 中文行内正下方淡入展开（总纲第 5、9 节）。
          优先内置/已落库 zh_text（双语书唯一路径）；纯日语书无 zh_text 时读 AI 译文 store（流式/加载/错误）。 */}
      {showZh &&
        (seg.zh_text ? (
          <p className="reader-zh" lang="zh">
            {seg.zh_text}
          </p>
        ) : ai ? (
          <ZhTranslation seg={seg} entry={ai} onRetry={onRetry} />
        ) : null)}
    </div>
  )
})

// AI 译文渲染：加载态（可能已有流式文本一点点冒出）/ 完成 / 错误可点重试。保持 .reader-zh 淡入。
function ZhTranslation({
  seg,
  entry,
  onRetry
}: {
  seg: Segment
  entry: import('../ai-translation').TranslationEntry
  onRetry?: (seg: Segment) => void
}): React.JSX.Element {
  if (entry.status === 'error') {
    return (
      <p className="reader-zh reader-zh-error" lang="zh">
        译文获取失败：{entry.error}
        {onRetry && (
          <button className="reader-zh-retry" onClick={() => onRetry(seg)}>
            重试
          </button>
        )}
      </p>
    )
  }
  // loading：有已收文本就显示（流式冒出），否则「翻译中…」占位。
  return (
    <p className="reader-zh" lang="zh">
      {entry.text || (entry.status === 'loading' ? '翻译中…' : '')}
    </p>
  )
}

function ImageSegment({ imageRef }: { imageRef: string | null }): React.JSX.Element {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    if (!imageRef) return
    let alive = true
    // getImagePath（契约 4）现返 data URL（会话 18：修 file:// 格式/源限制坑）；空串=读盘失败，保持 placeholder。
    window.chion.getImagePath(imageRef).then((dataUrl) => {
      if (alive && dataUrl) setSrc(dataUrl)
    })
    return () => {
      alive = false
    }
  }, [imageRef])
  if (!src) return <div className="reader-image-placeholder" />
  return (
    <div className="reader-image">
      <img src={src} alt="" loading="lazy" />
    </div>
  )
}
