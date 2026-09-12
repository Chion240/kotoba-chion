import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { BookMeta } from '../../../../shared/contracts'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog'

function coverChar(title: string): string {
  return [...title.trim()][0] ?? '書'
}

export function BookCard({
  book,
  onOpen,
  onDelete
}: {
  book: BookMeta
  onOpen: (book: BookMeta) => void
  onDelete: (bookId: number) => void
}): React.JSX.Element {
  const [confirming, setConfirming] = useState(false)
  const [coverUrl, setCoverUrl] = useState('')
  const [progress, setProgress] = useState<{ percent: number; updatedAt: number } | null>(null)
  const kindLabel = book.kind === 'bilingual' ? '双语' : '纯日语'

  useEffect(() => {
    let alive = true
    setCoverUrl('')
    if (book.cover_ref) {
      window.chion.getImagePath(book.cover_ref).then((url) => {
        if (alive) setCoverUrl(url)
      })
    }
    return () => {
      alive = false
    }
  }, [book.cover_ref])

  useEffect(() => {
    let alive = true
    void Promise.all([window.chion.getProgress(book.id), window.chion.listChapters(book.id)]).then(
      ([saved, chapters]) => {
        if (!alive || !saved || chapters.length === 0) return
        const endSeq = Math.max(...chapters.map((chapter) => chapter.endSeq))
        const percent = endSeq > 0 ? Math.min(100, Math.max(0, (saved.seq / endSeq) * 100)) : 0
        setProgress({ percent, updatedAt: saved.updated_at })
      }
    )
    return () => {
      alive = false
    }
  }, [book.id])

  const progressLabel = progress ? `${Math.round(progress.percent)}% 已读` : '尚未开始'
  const updatedLabel = progress
    ? new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(progress.updatedAt)
    : '准备阅读'

  return (
    <article className="book-card group">
      <button
        onClick={() => onOpen(book)}
        className="book-cover"
      >
        {coverUrl ? (
          <img src={coverUrl} alt={`《${book.title}》封面`} className="size-full object-cover" />
        ) : (
          <span className="book-cover-placeholder">
            {coverChar(book.title)}
          </span>
        )}
        <span className="book-kind">
          {kindLabel}
        </span>
        <span
          aria-hidden
          className="book-spine"
        />
      </button>
      <div className="book-info">
        <div className="book-title-row">
          <span className="book-title" title={book.title}>
          {book.title}
          </span>
        <Button
          variant="ghost"
          size="icon"
          className="book-delete size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
          onClick={() => setConfirming(true)}
          title="删除"
        >
          <Trash2 className="size-3.5" />
        </Button>
        </div>
        <div className="book-meta">
          <span>{kindLabel}</span>
          <span aria-hidden>·</span>
          <span>{updatedLabel}</span>
        </div>
        <div className="book-progress-row">
          <div className="book-progress-track" aria-hidden="true">
            <span style={{ width: `${progress?.percent ?? 0}%` }} />
          </div>
          <span>{progressLabel}</span>
        </div>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除《{book.title}》？</DialogTitle>
            <DialogDescription>
              将删除书内容、阅读进度与插图，不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">取消</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirming(false)
                onDelete(book.id)
              }}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  )
}
