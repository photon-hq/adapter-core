const DEFAULT_CAP = 1000;

export interface SeenSet {
  /** `true` if `id` was already seen; otherwise records it and returns `false`. */
  seen(id: string): boolean;
}

/**
 * A bounded, insertion-order-evicting "have I already processed this id?" set.
 *
 * Fusor delivery is at-least-once (even with an immediate ack), so handlers must
 * dedupe on a stable id (`message.id` / `update_id` / `eventId`) for at-most-once
 * side effects. This is in-memory and per-process only — not durable across
 * restarts or instances; persist when correctness demands true idempotency.
 */
export const boundedSeenSet = (cap: number = DEFAULT_CAP): SeenSet => {
  const processed = new Set<string>();
  return {
    seen(id: string): boolean {
      if (processed.has(id)) {
        return true;
      }
      processed.add(id);
      if (processed.size > cap) {
        const oldest = processed.values().next().value; // Set keeps insertion order
        if (oldest !== undefined) {
          processed.delete(oldest);
        }
      }
      return false;
    },
  };
};
