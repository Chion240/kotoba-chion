import type { Token } from '../../../../worker/contract'

export class SegmentTokenStore {
  private values = new Map<number, Token[]>()
  private listeners = new Map<number, Set<() => void>>()

  get(seq: number): Token[] | undefined {
    return this.values.get(seq)
  }

  set(seq: number, tokens: Token[]): void {
    if (this.values.get(seq) === tokens) return
    this.values.set(seq, tokens)
    this.listeners.get(seq)?.forEach((listener) => listener())
  }

  subscribe(seq: number, listener: () => void): () => void {
    let subscribers = this.listeners.get(seq)
    if (!subscribers) {
      subscribers = new Set()
      this.listeners.set(seq, subscribers)
    }
    subscribers.add(listener)
    return () => {
      subscribers.delete(listener)
      if (!subscribers.size) this.listeners.delete(seq)
    }
  }

  clear(): void {
    const changed = [...this.values.keys()]
    this.values.clear()
    for (const seq of changed) this.listeners.get(seq)?.forEach((listener) => listener())
  }
}
