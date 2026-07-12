/**
 * In-process keyed async mutex.
 *
 * Audit finding (booking / capacity race): bookings.create does
 *   await getBookingsByAmenityAndDate(...)  // read occupancy
 *   ... assertWithinCapacity ...
 *   await createBooking(...)                // write
 * The awaits yield the event loop, so two concurrent requests for the SAME slot
 * can both read the pre-insert occupancy, both pass the capacity check, and both
 * insert → overbooking. Node is single-threaded, so serializing the check+write
 * for a given slot key eliminates the race for this (single-instance) deployment.
 * (Multi-instance would additionally need a DB-level guard; the app runs as one
 * Render instance — see the deploy-mechanics memory.)
 */
const chains = new Map<string, Promise<unknown>>();

/** Run `fn` such that all calls sharing `key` execute one-at-a-time, in order.
 *  Different keys run concurrently. The lock is released even if `fn` throws. */
export function runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(key) ?? Promise.resolve();
  // Chain after whatever is currently queued for this key, swallowing the prior
  // result/error so one task's failure doesn't reject the next.
  const run = prev.then(() => fn(), () => fn());
  // Keep the chain pointer current; clean up when this is the tail to avoid leaks.
  chains.set(key, run);
  run.finally(() => {
    if (chains.get(key) === run) chains.delete(key);
  }).catch(() => { /* handled by caller via the returned promise */ });
  return run;
}
