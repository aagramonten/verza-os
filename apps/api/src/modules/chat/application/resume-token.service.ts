import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Opaque resume tokens for public chat sessions.
 *
 * Security properties (plan §8.7 / Day 2 spec):
 * - 256 bits of CSPRNG entropy, base64url-encoded (no padding, URL-safe)
 * - only the SHA-256 hash is persisted; the raw token exists once, in the
 *   session-creation response
 * - verification is timing-safe
 * - expiry and revocation are enforced by the application service using the
 *   fields stored next to the hash
 */
export class ResumeTokenService {
  generate(): { rawToken: string; tokenHash: string } {
    const rawToken = randomBytes(32).toString('base64url');
    return { rawToken, tokenHash: this.hash(rawToken) };
  }

  hash(rawToken: string): string {
    return createHash('sha256').update(rawToken, 'utf8').digest('hex');
  }

  verify(rawToken: string, storedHash: string): boolean {
    const candidate = Buffer.from(this.hash(rawToken), 'hex');
    const stored = Buffer.from(storedHash, 'hex');
    if (candidate.length !== stored.length) {
      return false;
    }
    return timingSafeEqual(candidate, stored);
  }
}
