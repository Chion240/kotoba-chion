// storage · SQLite 层（契约 1：Segment）
// 只依赖 better-sqlite3，不碰 electron —— 便于独立自测（铁律 4）。
import Database from 'better-sqlite3'
import type {
  BookMeta,
  ChapterMeta,
  Segment,
  SegmentInput
} from '../../../shared/contracts'

export type { BookMeta, ChapterMeta, Segment, SegmentInput } from '../../../shared/contracts'

// 契约 1（V3_MASTER_PLAN 第 4 节）原样落地，字段禁改。
// 数据契约定义在 shared/contracts，SQLite 模块只负责持久化实现。

const SCHEMA = `
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('bilingual','jp')),
  created_at INTEGER NOT NULL,
  cover_ref TEXT
);
CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id),
  seq INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id),
  chapter_id INTEGER NOT NULL REFERENCES chapters(id),
  seq INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pair','heading','image')),
  jp_text TEXT NOT NULL DEFAULT '',
  zh_text TEXT NOT NULL DEFAULT '',
  zh_source TEXT CHECK (zh_source IN ('builtin','ai') OR zh_source IS NULL),
  ruby TEXT NOT NULL DEFAULT '[]',
  image_ref TEXT
);
CREATE INDEX IF NOT EXISTS idx_segments_book_seq ON segments(book_id, seq);
-- listChapters 按 chapter_id 聚合求每章 min/max seq；无此索引要全表扫描所有书的段。
CREATE INDEX IF NOT EXISTS idx_segments_chapter ON segments(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book_id);
`

type Row = {
  id: number
  book_id: number
  chapter_id: number
  seq: number
  type: Segment['type']
  jp_text: string
  zh_text: string
  zh_source: Segment['zh_source']
  ruby: string
  image_ref: string | null
}

function toSegment(r: Row): Segment {
  return { ...r, ruby: JSON.parse(r.ruby) as Segment['ruby'] }
}

export function openDb(path: string) {
  const db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
  // V3 数据库可能由旧版本创建，新增封面列时平滑迁移，不影响已有书籍。
  const bookColumns = db.prepare(`PRAGMA table_info(books)`).all() as Array<{ name: string }>
  if (!bookColumns.some((column) => column.name === 'cover_ref')) {
    db.exec(`ALTER TABLE books ADD COLUMN cover_ref TEXT`)
  }

  const qSegments = db.prepare<[number, number, number]>(
    `SELECT * FROM segments WHERE book_id = ? AND seq BETWEEN ? AND ? ORDER BY seq`
  )
  const insBook = db.prepare(
    `INSERT INTO books (title, kind, created_at, cover_ref) VALUES (@title, @kind, @created_at, @cover_ref)`
  )
  const insChapter = db.prepare(
    `INSERT INTO chapters (book_id, seq, title) VALUES (@book_id, @seq, @title)`
  )
  const insSegment = db.prepare(
    `INSERT INTO segments (book_id, chapter_id, seq, type, jp_text, zh_text, zh_source, ruby, image_ref)
     VALUES (@book_id, @chapter_id, @seq, @type, @jp_text, @zh_text, @zh_source, @ruby, @image_ref)`
  )
  const updAiTranslation = db.prepare(
    `UPDATE segments SET zh_text = ?, zh_source = 'ai' WHERE id = ?`
  )
  // 契约 4 扩展（CR-1）：书架列表（最新导入在前）+ 删书（清 db 两库；进度/图片目录由 main 编排）。
  const qBooks = db.prepare(
    // 最新导入在前；同毫秒导入按 id 兜底（created_at 毫秒粒度可能相等）。
    `SELECT id, title, kind, created_at, cover_ref FROM books ORDER BY created_at DESC, id DESC`
  )
  const updBookCover = db.prepare(`UPDATE books SET cover_ref = ? WHERE id = ?`)
  // 契约 4 扩展（CR-2）：列章节 —— GROUP BY 聚合 segments 求每章 min/max seq。
  // 内联 JOIN 保证只列真有段的章（空章不会误出现在目录），按章内首段 seq 排序。
  const qChapters = db.prepare<[number]>(
    `SELECT c.id AS id, c.seq AS ordinal, c.title AS title,
            MIN(s.seq) AS startSeq, MAX(s.seq) AS endSeq
     FROM chapters c JOIN segments s ON s.chapter_id = c.id
     WHERE c.book_id = ?
     GROUP BY c.id
     ORDER BY startSeq`
  )
  const delSegments = db.prepare(`DELETE FROM segments WHERE book_id = ?`)
  const delChapters = db.prepare(`DELETE FROM chapters WHERE book_id = ?`)
  const delBook = db.prepare(`DELETE FROM books WHERE id = ?`)

  const insManySegments = db.transaction((segs: SegmentInput[]) => {
    for (const s of segs) {
      insSegment.run({ ...s, ruby: JSON.stringify(s.ruby) })
    }
  })

  return {
    raw: db,
    // 契约 4：getSegments(book_id, seqFrom, seqTo) —— 闭区间。
    getSegments(bookId: number, seqFrom: number, seqTo: number): Segment[] {
      return (qSegments.all(bookId, seqFrom, seqTo) as Row[]).map(toSegment)
    },
    // 契约 4：saveAiTranslation(segId, zh) —— 落库复用，标记 zh_source='ai'。
    saveAiTranslation(segId: number, zh: string): void {
      updAiTranslation.run(zh, segId)
    },
    // 写入 API（epub-import 会话调用）。
    insertBook(title: string, kind: 'bilingual' | 'jp'): number {
      return Number(insBook.run({ title, kind, created_at: Date.now(), cover_ref: null }).lastInsertRowid)
    },
    updateBookCover(bookId: number, coverRef: string): void {
      updBookCover.run(coverRef, bookId)
    },
    insertChapter(bookId: number, seq: number, title = ''): number {
      return Number(insChapter.run({ book_id: bookId, seq, title }).lastInsertRowid)
    },
    insertSegments(segs: SegmentInput[]): void {
      insManySegments(segs)
    },
    // 契约 4 扩展（CR-1）：书架查询。
    listBooks(): BookMeta[] {
      return qBooks.all() as BookMeta[]
    },
    // 契约 4 扩展（CR-2）：列一本书的章节（含每章起止 seq），供目录跳转 + 按章加载。
    listChapters(bookId: number): ChapterMeta[] {
      return qChapters.all(bookId) as ChapterMeta[]
    },
    // 契约 4 扩展（CR-1）：删书 db 侧（segments→chapters→books，一事务）。进度/图片目录归 main 编排。
    deleteBook: db.transaction((bookId: number): void => {
      delSegments.run(bookId)
      delChapters.run(bookId)
      delBook.run(bookId)
    }),
    close(): void {
      db.close()
    }
  }
}

export type StorageDb = ReturnType<typeof openDb>
