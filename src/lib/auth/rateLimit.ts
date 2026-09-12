/**
 * In-memory sign-in throttling.
 *
 * The POS runs as a single local server on the restaurant's own network, so a
 * per-process counter is the right size of solution: it blunts password guessing from
 * a terminal on the LAN without adding infrastructure. Counters reset when the server
 * restarts, which is acceptable for a shop-floor machine.
 */

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 5 * 60 * 1000; // failures older than this no longer count
const LOCKOUT_MS = 5 * 60 * 1000; // how long a tripped key stays locked

interface Attempts {
  count: number;
  firstFailureAt: number;
  lockedUntil: number;
}

const attempts = new Map<string, Attempts>();

/** Drop entries that can no longer affect a decision, so the map cannot grow forever. */
function evictStale(now: number) {
  for (const [key, entry] of attempts) {
    if (entry.lockedUntil < now && now - entry.firstFailureAt > WINDOW_MS) {
      attempts.delete(key);
    }
  }
}

export interface ThrottleState {
  blocked: boolean;
  retryAfterSeconds: number;
}

/** Check whether a key may attempt a sign-in right now. */
export function checkThrottle(key: string): ThrottleState {
  const now = Date.now();
  evictStale(now);

  const entry = attempts.get(key);
  if (!entry) return { blocked: false, retryAfterSeconds: 0 };

  if (entry.lockedUntil > now) {
    return { blocked: true, retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000) };
  }
  return { blocked: false, retryAfterSeconds: 0 };
}

/** Record a failed sign-in, locking the key once it trips the limit. */
export function recordFailure(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.firstFailureAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstFailureAt: now, lockedUntil: 0 });
    return;
  }

  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
    entry.count = 0;
    entry.firstFailureAt = now;
  }
}

/** Clear a key's history after a successful sign-in. */
export function recordSuccess(key: string): void {
  attempts.delete(key);
}

/** Testing seam. */
export function resetThrottle(): void {
  attempts.clear();
}
