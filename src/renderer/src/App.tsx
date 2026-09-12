import { useState } from 'react'
import type { BookMeta } from '../../shared/contracts'
import { Library, ReaderScreen } from '@/modules/library'
import { SettingsDialog } from '@/modules/settings'

// library 会话接管路由：书架 ↔ 阅读器。选中书 → ReaderScreen（进度往返）；返回 → 书架。
// 设置的开机应用已提前到 main.tsx（首帧前，防暗色闪白）；store 变更时自行重刷 DOM（setSetting 内）。
export function App(): React.JSX.Element {
  const [openBook, setOpenBook] = useState<BookMeta | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      {openBook ? (
        <ReaderScreen bookId={openBook.id} kind={openBook.kind} onBack={() => setOpenBook(null)} />
      ) : (
        <Library onOpen={setOpenBook} onSettings={() => setSettingsOpen(true)} />
      )}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  )
}
