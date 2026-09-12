// ai-store · 逻辑日纯逻辑（CONTEXT.md「逻辑日」）：时间戳 - 3h 后取本地 YYYY-MM-DD。
// 晚 23:00–次日 02:59 都归到起始那天。无 electron 依赖 —— test:ai 直转（铁律 4）。

// CR-3 类型（对话存档）：ChatRound = 一轮 done 的产物；ChatArchiveDay = 某逻辑日累积的轮次。
export type ChatRound = { userText: string; assistantText: string; ts: number }
export type ChatArchiveDay = { day: string; rounds: ChatRound[] }

const THREE_HOURS = 3 * 60 * 60 * 1000

// 时间戳 → 逻辑日（本地 YYYY-MM-DD）。减 3h 后取本地日期部分。
export function logicalDay(ts: number): string {
  const d = new Date(ts - THREE_HOURS)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 纯合并：把一轮追加到对应逻辑日。命中当天则追加，否则新建一天。不改入参（CONTEXT：同日追加合并）。
export function appendRound(days: ChatArchiveDay[], round: ChatRound): ChatArchiveDay[] {
  const day = logicalDay(round.ts)
  const idx = days.findIndex((d) => d.day === day)
  if (idx === -1) return [...days, { day, rounds: [round] }]
  return days.map((d, i) => (i === idx ? { ...d, rounds: [...d.rounds, round] } : d))
}
