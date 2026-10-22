// Server snapshots are the base; pending actions are always replayed above them.
export class OptimisticDayQueue<T> {
  private base: T;
  private patches = new Map<number, (day: T) => void>();
  constructor(base: T) { this.base = base; }
  add(id: number, patch: (day: T) => void) { this.patches.set(id, patch); return this.value(); }
  settle(id: number, server?: T) {
    this.patches.delete(id);
    if (server !== undefined) this.base = server;
    return this.value();
  }
  get pending() { return this.patches.size; }
  value(): T {
    const next = structuredClone(this.base);
    for (const patch of this.patches.values()) patch(next);
    return next;
  }
}