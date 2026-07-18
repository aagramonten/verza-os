import type { Clock } from '../application/ports.js';

export interface RateVerdict {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface LoginRateLimiter {
  hit(key: string): RateVerdict;
}

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Fixed-window per-key limiter for the public login endpoint (AGENTS.md:
 * public endpoints require rate limiting). Process-local and best-effort —
 * sufficient for the single-instance MVP; a shared store replaces it at scale.
 */
export class InMemoryLoginRateLimiter implements LoginRateLimiter {
  private readonly windows = new Map<string, Window>();
  private readonly windowMs = 60_000;

  constructor(
    private readonly maxPerMinute: number,
    private readonly clock: Clock,
  ) {}

  hit(key: string): RateVerdict {
    const now = this.clock.now().getTime();
    const existing = this.windows.get(key);

    if (!existing || existing.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (existing.count >= this.maxPerMinute) {
      return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
    }

    existing.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }
}
