import { createHash, randomBytes } from 'node:crypto';
import type { GeneratedRefreshToken, RefreshTokenCodec } from '../application/ports.js';

const RAW_BYTES = 32; // 256 bits of entropy

/**
 * Opaque refresh tokens: 256-bit random strings, stored only as their SHA-256
 * hash (mirrors ChatSession.resumeTokenHash). SHA-256 is appropriate here
 * because the input is high-entropy random — no password stretching needed.
 */
export class Sha256RefreshTokenCodec implements RefreshTokenCodec {
  generate(): GeneratedRefreshToken {
    const raw = randomBytes(RAW_BYTES).toString('base64url');
    return { raw, hash: this.hash(raw) };
  }

  hash(raw: string): string {
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }
}
