import type { Clock, RateLimiter } from '../application/ports.js';

interface WindowEntry {
  windowStartMs: number;
  count: number;
}

/** MVP fixed-window limiter. Replace behind the port before horizontal scale. */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, WindowEntry>();
  private lastSweepMs = 0;

  constructor(
    private readonly limitPerMinute: number,
    private readonly clock: Clock,
    private readonly maxEntries = 10_000,
  ) {}

  hit(key: string): { allowed: boolean; retryAfterSeconds: number } {
    const now = this.clock.now().getTime();
    this.prune(now);
    const entry = this.windows.get(key);
    if (!entry || now - entry.windowStartMs >= 60_000) {
      this.windows.set(key, { windowStartMs: now, count: 1 });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    entry.count += 1;
    return entry.count <= this.limitPerMinute
      ? { allowed: true, retryAfterSeconds: 0 }
      : {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil((entry.windowStartMs + 60_000 - now) / 1000)),
        };
  }

  private prune(now: number): void {
    if (now - this.lastSweepMs < 60_000 && this.windows.size < this.maxEntries) return;
    for (const [key, entry] of this.windows) {
      if (now - entry.windowStartMs >= 60_000) this.windows.delete(key);
    }
    while (this.windows.size >= this.maxEntries) {
      const oldest = this.windows.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.windows.delete(oldest);
    }
    this.lastSweepMs = now;
  }
}
