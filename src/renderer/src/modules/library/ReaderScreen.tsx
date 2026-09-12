import { useEffect, useRef, useState } from 'react'
import { Reader } from '../reader-view/Reader'

// ReaderScreen：打开书时用 getProgress 跳到上次位置（initialSeq），阅读中防抖 saveProgress（契约 4）。
// reader-view 负责按进度取段/滚动，本层只接持久化（总纲第 6 节 library 职责）。
export function ReaderScreen({
  bookId,
  kind = 'bilingual',
  onBack
}: {
  bookId: number
  // 书级安全门传递（会话 15）：纯日语书按 t 才走 AI 译文；默认 'bilingual' 最安全，向后兼容。
  kind?: 'bilingual' | 'jp'
  onBack: () => void
}): React.JSX.Element {
  // initialSeq: undefined=进度未取回（先不渲 Reader，避免从 0 起再跳位闪动）；number=就绪。
  const [initialSeq, setInitialSeq] = useState<number | undefined>(undefined)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSaved = useRef(-1)

  useEffect(() => {
    setInitialSeq(undefined)
    void window.chion.getProgress(bookId).then((p) => setInitialSeq(p?.seq ?? 0))
  }, [bookId])

  // 进度防抖落库：顶段 seq 变化 800ms 后写，避免滚动中高频 IPC。
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    },
    []
  )

  const onProgress = (seq: number): void => {
    if (seq === lastSaved.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      lastSaved.current = seq
      void window.chion.saveProgress(bookId, seq)
    }, 800)
  }

  if (initialSeq === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        载入中…
      </div>
    )
  }

  return (
    <Reader
      bookId={bookId}
      kind={kind}
      initialSeq={initialSeq}
      onProgress={onProgress}
      onBack={onBack}
    />
  )
}
