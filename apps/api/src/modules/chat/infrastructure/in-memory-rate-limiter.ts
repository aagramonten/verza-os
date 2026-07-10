import type { Clock, RateLimiter } from '../application/ports.js';

interface WindowEntry {
  windowStartMs: number;
  count: number;
}

/**
 * Fixed-window in-memory rate limiter.
 *
 * KNOWN LIMITATION (accepted for the MVP, documented in the plan §8.4): state
 * lives in process memory, so limits are per instance. Running more than one
 * API instance multiplies the effective limit. Replace with a Redis-backed
 * implementation of the same RateLimiter port before scaling horizontally.
 */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, WindowEntry>();

  constructor(
    private readonly limitPerMinute: number,
    private readonly clock: Clock,
  ) {}

  hit(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const nowMs = this.clock.now().getTime();
    const windowMs = 60_000;
    const entry = this.windows.get(key);

    if (entry === undefined || nowMs - entry.windowStartMs >= windowMs) {
      this.windows.set(key, { windowStartMs: nowMs, count: 1 });
      this.evictStale(nowMs, windowMs);
      return { allowed: true, retryAfterSeconds: 0 };
    }

    entry.count += 1;
    if (entry.count <= this.limitPerMinute) {
      return { allowed: true, retryAfterSeconds: 0 };
    }

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((entry.windowStartMs + windowMs - nowMs) / 1000),
    );
    return { allowed: false, retryAfterSeconds };
  }

  /** Bounded memory: drop windows older than one interval. */
  private evictStale(nowMs: number, windowMs: number): void {
    if (this.windows.size < 10_000) {
      return;
    }
    for (const [key, entry] of this.windows) {
      if (nowMs - entry.windowStartMs >= windowMs) {
        this.windows.delete(key);
      }
    }
  }
}
