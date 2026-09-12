import type { ImportState } from './import-flow'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'

// 导入对话框：选完文件后让用户手选「双语 / 纯日语」（决策 6，绝不自动判类型）。
// importing 显示 loading；error 显示失败提示（会话 4 说损坏 epub 会 reject）。
export function ImportDialog({
  state,
  onChooseMode,
  onCancel
}: {
  state: ImportState
  onChooseMode: (mode: 'bilingual' | 'jp') => void
  onCancel: () => void
}): React.JSX.Element {
  const open = state.status !== 'idle'

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent>
        {state.status === 'choosing' && (
          <>
            <DialogHeader>
              <DialogTitle>这是哪种书？</DialogTitle>
              <DialogDescription>
                导入方式不同，需手动选择。双语书按 t 显示内置译文；纯日语书按 t 走 AI 译文。
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 py-2">
              <ModeCard
                title="双语书"
                desc="一段日文一段中文，配对入库"
                onClick={() => onChooseMode('bilingual')}
              />
              <ModeCard
                title="纯日语书"
                desc="仅日文，按 t 临时 AI 翻译"
                onClick={() => onChooseMode('jp')}
              />
            </div>
          </>
        )}

        {state.status === 'importing' && (
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-primary/30 border-t-primary"
              />
              导入中…
            </DialogTitle>
            <DialogDescription>
              正在解析并入库（{state.mode === 'bilingual' ? '双语' : '纯日语'}），请稍候。
            </DialogDescription>
          </DialogHeader>
        )}

        {state.status === 'error' && (
          <>
            <DialogHeader>
              <DialogTitle>导入失败</DialogTitle>
              <DialogDescription className="break-all">{state.message}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={onCancel}>
                关闭
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ModeCard({
  title,
  desc,
  onClick
}: {
  title: string
  desc: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-1 rounded-xl border bg-card p-4 text-left shadow-[var(--shadow-xs)] transition-all duration-200 [transition-timing-function:var(--ease-spring)] hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent hover:shadow-[var(--shadow-md)] active:translate-y-0 active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <span className="font-medium transition-colors group-hover:text-accent-foreground">
        {title}
      </span>
      <span className="text-xs text-muted-foreground">{desc}</span>
    </button>
  )
}
