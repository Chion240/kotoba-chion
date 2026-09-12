import { useEffect, useState } from 'react'
import type { ChapterMeta, Segment } from '../../../../shared/contracts'

export type ReaderSearchResult = {
  seq: number
  chapterIndex: number
  chapterTitle: string
  segment: Segment
  snippet: string
}

function makeSnippet(text: string, query: string): string {
  const lower = text.toLocaleLowerCase()
  const at = lower.indexOf(query.toLocaleLowerCase())
  if (at < 0) return text.slice(0, 72)
  const start = Math.max(0, at - 28)
  const end = Math.min(text.length, at + query.length + 44)
  return `${start ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}

export function useReaderSearch(bookId: number, chapters: ChapterMeta[]): {
  query: string
  setQuery: (value: string) => void
  results: ReaderSearchResult[]
  searching: boolean
} {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ReaderSearchResult[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const needle = query.trim()
    if (!needle || !chapters.length) {
      setResults([])
      setSearching(false)
      return
    }
    let alive = true
    setSearching(true)
    void (async () => {
      const found: ReaderSearchResult[] = []
      for (let i = 0; i < chapters.length && found.length < 200; i++) {
        const batch = await window.chion.getSegments(bookId, chapters[i].startSeq, chapters[i].endSeq)
        for (const segment of batch) {
          const haystack = `${segment.jp_text}\n${segment.zh_text}`.toLocaleLowerCase()
          if (!haystack.includes(needle.toLocaleLowerCase())) continue
          found.push({
            seq: segment.seq,
            chapterIndex: i,
            chapterTitle: chapters[i].title || `第 ${i + 1} 章`,
            segment,
            snippet: makeSnippet(segment.jp_text || segment.zh_text, needle)
          })
          if (found.length >= 200) break
        }
      }
      if (!alive) return
      setResults(found)
      setSearching(false)
    })().catch(() => {
      if (alive) {
        setResults([])
        setSearching(false)
      }
    })
    return () => {
      alive = false
    }
  }, [bookId, chapters, query])

  return { query, setQuery, results, searching }
}

