// storage · 阅读进度（应用状态，走 electron-store，非 SQLite）
// 决策 3：书内容用 SQLite，应用状态用 electron-store。进度属后者。
import Store from 'electron-store'

export type Progress = { seq: number; updated_at: number }

type ProgressSchema = { progress: Record<string, Progress> }

// cwd 可注入 —— 生产用 app.getPath('userData')，自测传临时目录（不依赖 electron app）。
export function openProgress(cwd?: string) {
  const store = new Store<ProgressSchema>({
    name: 'reading-progress',
    defaults: { progress: {} },
    ...(cwd ? { cwd } : {})
  })

  return {
    saveProgress(bookId: number, seq: number): void {
      const all = store.get('progress')
      all[String(bookId)] = { seq, updated_at: Date.now() }
      store.set('progress', all)
    },
    getProgress(bookId: number): Progress | null {
      return store.get('progress')[String(bookId)] ?? null
    },
    // 契约 4 扩展（CR-1）：删书时清进度（library 会话删书三处之一）。
    deleteProgress(bookId: number): void {
      const all = store.get('progress')
      delete all[String(bookId)]
      store.set('progress', all)
    }
  }
}

export type ProgressStore = ReturnType<typeof openProgress>
