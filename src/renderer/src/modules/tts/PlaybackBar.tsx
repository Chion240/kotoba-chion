// tts · PlaybackBar（朗读模式开关 + 连读全文按钮 + 状态）。挂在 reader 工具栏。
// Phase 2：onStart/onStop 由 Reader 传入（useContinuousReading 返回，需要 segments/chapters context）。
import { Volume2, Play, Square, Loader2 } from 'lucide-react'
import { usePlayback, setEnabled } from './playback-store'
import './tts.css'

export function PlaybackBar({
  onStart,
  onStop
}: {
  onStart?: () => void
  onStop?: () => void
}): React.JSX.Element {
  const p = usePlayback()
  return (
    <div className="tts-bar">
      <button
        className={p.enabled ? 'reader-mode-btn is-active' : 'reader-mode-btn'}
        onClick={() => setEnabled(!p.enabled)}
        title="朗读模式：开启后左键读词、右键读段（与复制同时触发）"
      >
        <Volume2 size={14} /> 朗读
      </button>
      {p.enabled && (
        <div className="tts-gran">
          {/* 连读全文 / 停止连读 */}
          {!p.reading ? (
            <button
              className="tts-seg"
              onClick={onStart}
              title="从当前行开始连续朗读全文"
            >
              <Play size={12} /> 朗读全文
            </button>
          ) : (
            <button
              className="tts-seg is-active"
              onClick={onStop}
              title="停止连续朗读"
            >
              <Square size={12} /> 停止
            </button>
          )}
          {/* 单段点击即播状态 */}
          {p.status === 'loading' && (
            <span className="tts-status tts-spin-wrap">
              <Loader2 size={13} className="tts-spin" /> 合成中…
            </span>
          )}
          {!p.reading && p.status === 'playing' && (
            <span className="tts-status">
              <Play size={12} />
            </span>
          )}
          {p.status === 'error' && <span className="tts-status tts-error">{p.error}</span>}
        </div>
      )}
    </div>
  )
}
