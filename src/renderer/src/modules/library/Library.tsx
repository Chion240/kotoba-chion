import type { BookMeta } from '../../../../shared/contracts'
import { Settings, Plus, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLibrary } from './useLibrary'
import { BookCard } from './BookCard'
import { ImportDialog } from './ImportDialog'
import './library.css'

// 书架页：列出已导入的书（占位封面/标题/类型），点一本 → 打开（onOpen 交给 App 路由）。
// 顶部「导入」按钮走文件选择器 → 选 mode → importBook（决策 6）。
export function Library({
  onOpen,
  onSettings
}: {
  onOpen: (book: BookMeta) => void
  onSettings?: () => void
}): React.JSX.Element {
  const { books, loading, error, refresh, importState, pickAndChoose, confirmImport, cancelImport, deleteBook } =
    useLibrary()

  return (
    <div className="library-root">
      <header className="library-header">
        <div className="library-brand">
          <BookOpen className="size-5" />
          <div>
            <p className="library-kicker">阅读台</p>
            <h1>kotoba-chion</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onSettings && (
            <Button variant="ghost" size="icon" onClick={onSettings} title="设置">
              <Settings className="size-4" />
            </Button>
          )}
          <Button onClick={() => void pickAndChoose()}>
            <Plus className="size-4" />
            导入 EPUB
          </Button>
        </div>
      </header>

      <main className="library-main">
        {loading ? (
          <div className="library-loading">
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
            载入中…
          </div>
        ) : error ? (
          <div className="library-empty" role="alert">
            <p className="library-empty-title">书架载入失败</p>
            <p className="library-empty-copy">{error}</p>
            <Button variant="outline" onClick={() => void refresh()}>重试</Button>
          </div>
        ) : books.length === 0 ? (
          <EmptyState onImport={() => void pickAndChoose()} />
        ) : (
          <>
            <div className="library-heading">
              <div>
                <p className="library-eyebrow">我的书架</p>
                <h2>继续阅读</h2>
              </div>
              <p className="library-count">{books.length} 本书</p>
            </div>
            <div className="library-grid">
              {books.map((b) => (
                <BookCard
                  key={b.id}
                  book={b}
                  onOpen={onOpen}
                  onDelete={(id) => void deleteBook(id)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      <ImportDialog
        state={importState}
        onChooseMode={(m) => void confirmImport(m)}
        onCancel={cancelImport}
      />
    </div>
  )
}

function EmptyState({ onImport }: { onImport: () => void }): React.JSX.Element {
  return (
    <div className="library-empty">
      <div className="library-empty-mark">
        <BookOpen className="size-8" />
      </div>
      <div>
        <p className="library-empty-title">书架还是空的</p>
        <p className="library-empty-copy">导入一本 EPUB 开始阅读。</p>
      </div>
      <Button onClick={onImport}>
        <Plus className="size-4" />
        导入 EPUB
      </Button>
    </div>
  )
}
