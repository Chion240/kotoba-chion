# storage 模块（main 侧）

负责会话：storage（第 1 批 · 会话 2）。依赖契约 1、4。
职责：SQLite schema + 段落查询 API + 阅读进度。better-sqlite3 在主进程。

## 文件

- `db.ts` — SQLite 层（只依赖 better-sqlite3，不碰 electron，便于独立自测）。
  表：`books` / `chapters` / `segments`（契约 1 原样落地），`(book_id, seq)` 建索引。
  API：`getSegments(bookId, seqFrom, seqTo)`（闭区间）、`saveAiTranslation(segId, zh)`、
  写入用 `insertBook` / `insertChapter` / `insertSegments`（供 epub-import 会话调用）。
- `progress.ts` — 阅读进度走 electron-store（决策 3：应用状态非书内容）。
  `saveProgress(bookId, seq)` / `getProgress(bookId)`。
- `index.ts` — 组装 + 注册契约 4 数据相关 IPC（`storage:*`）。生产装配 `createStorage()`。

## 接缝

- preload（`src/preload/index.ts`）已挂 `getSegments` / `saveAiTranslation` /
  `saveProgress` / `getProgress` 到 `window.chion`。
- `importBook` / `getImagePath` 未实现 —— 留给 epub-import / library 会话续挂。
- `insertBook/Chapter/Segments` 是给 epub-import 的入库入口，从 `./modules/storage` 导入。

## 自测

`npm run test:storage` —— 建库→写 4 段假数据→按区间读回→AI 译文落库，断言一致。
用 electron 内置 node 跑（匹配 better-sqlite3 的 Electron ABI）。
