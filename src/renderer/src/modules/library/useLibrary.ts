// library · 书架数据 + 导入/删书动作。契约 4 扩展（CR-1）经 window.chion 调。
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { BookMeta } from '../../../../shared/contracts'
import { importReducer, initialImportState, type ImportState } from './import-flow'

export type UseLibrary = {
  books: BookMeta[]
  loading: boolean
  error: string | null
  importState: ImportState
  refresh: () => Promise<void>
  pickAndChoose: () => Promise<void> // 开文件选择器 → 进选 mode 态
  confirmImport: (mode: 'bilingual' | 'jp') => Promise<void>
  cancelImport: () => void
  deleteBook: (bookId: number) => Promise<void>
}

export function useLibrary(): UseLibrary {
  const [books, setBooks] = useState<BookMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [importState, dispatch] = useReducer(importReducer, initialImportState)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setBooks(await window.chion.listBooks())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const pickAndChoose = useCallback(async () => {
    const path = await window.chion.pickEpubFile()
    dispatch({ type: 'filePicked', path })
  }, [])

  // 导入在途标记：双击 mode 卡片/重复触发会并发 importBook 两次 → 同书入两遍。
  // reducer 态在 dispatch 后同 tick 内仍是旧的（React 批处理），故用 ref 挡同 tick 的第二次调用。
  const importingRef = useRef(false)

  const confirmImport = useCallback(
    async (mode: 'bilingual' | 'jp') => {
      if (importingRef.current) return
      const cur = importState
      if (cur.status !== 'choosing') return
      importingRef.current = true
      dispatch({ type: 'modeChosen', mode })
      try {
        await window.chion.importBook(cur.path, mode)
        dispatch({ type: 'succeeded' })
        await refresh()
      } catch (e) {
        dispatch({ type: 'failed', message: e instanceof Error ? e.message : String(e) })
      } finally {
        importingRef.current = false
      }
    },
    [importState, refresh]
  )

  const cancelImport = useCallback(() => dispatch({ type: 'cancel' }), [])

  const deleteBook = useCallback(
    async (bookId: number) => {
      await window.chion.deleteBook(bookId)
      await refresh()
    },
    [refresh]
  )

  return {
    books,
    loading,
    error,
    importState,
    refresh,
    pickAndChoose,
    confirmImport,
    cancelImport,
    deleteBook
  }
}
