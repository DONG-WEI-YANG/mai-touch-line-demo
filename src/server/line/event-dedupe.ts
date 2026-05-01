/**
 * LRU event-id de-duplication window.
 * seen(id) returns true if the id was already in the window, false if fresh.
 * When capacity is exceeded, the oldest-inserted entry is evicted.
 * capacity=0 disables tracking (always returns false).
 */
export function makeEventDedupe(capacity: number) {
  // Use a Map keyed by id; insertion order = LRU order.
  // On duplicate check we do NOT promote (read-only access keeps original order).
  // On new insert we add to end; if over capacity, delete the first (oldest) key.
  const window = new Map<string, true>();

  return {
    seen(id: string): boolean {
      if (capacity <= 0) return false;
      if (window.has(id)) return true;
      window.set(id, true);
      // Evict oldest entry when over capacity
      if (window.size > capacity) {
        const oldest = window.keys().next().value!;
        window.delete(oldest);
      }
      return false;
    },
  };
}
