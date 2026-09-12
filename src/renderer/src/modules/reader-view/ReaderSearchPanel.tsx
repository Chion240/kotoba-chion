import { Search, X } from 'lucide-react'
import type { ReaderSearchResult } from './reader-search'

export function ReaderSearchPanel({
  query,
  onQuery,
  results,
  searching,
  onNavigate,
  onClose
}: {
  query: string
  onQuery: (value: string) => void
  results: ReaderSearchResult[]
  searching: boolean
  onNavigate: (result: ReaderSearchResult) => void
  onClose: () => void
}): React.JSX.Element {
  return (
    <aside className="reader-tool-panel" aria-label="全文搜索">
      <div className="reader-tool-panel-header">
        <label className="reader-tool-search-input">
          <Search size={15} aria-hidden="true" />
          <input autoFocus value={query} onChange={(event) => onQuery(event.target.value)} placeholder="搜索全书" />
        </label>
        <button className="reader-icon-btn" onClick={onClose} title="关闭搜索" aria-label="关闭搜索">
          <X size={16} />
        </button>
      </div>
      <div className="reader-tool-panel-status" aria-live="polite">
        {searching ? '搜索中…' : query.trim() ? `${results.length}${results.length >= 200 ? '+' : ''} 个结果` : '输入文字搜索日文和译文'}
      </div>
      <div className="reader-search-results">
        {results.map((result) => (
          <button key={`${result.chapterIndex}-${result.seq}`} className="reader-search-result" onClick={() => onNavigate(result)}>
            <span className="reader-search-result-chapter">{result.chapterTitle}</span>
            <span>{result.snippet}</span>
          </button>
        ))}
      </div>
    </aside>
  )
}

