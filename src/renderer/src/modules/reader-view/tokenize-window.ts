export function tokenizeWindow(start: number, end: number, count: number, prefetch: number): number[] {
  const first = Math.max(0, start)
  const last = Math.min(count - 1, end)
  if (first > last) return []
  const indices: number[] = []
  for (let index = first; index <= last; index++) indices.push(index)
  for (let distance = 1; distance <= prefetch; distance++) {
    if (first - distance >= 0) indices.push(first - distance)
    if (last + distance < count) indices.push(last + distance)
  }
  return indices
}
