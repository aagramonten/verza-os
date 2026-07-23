import { createHash, randomBytes } from 'node:crypto';
import type { CustomerTokenCodec, GeneratedToken } from '../application/ports.js';

export class Sha256CustomerTokenCodec implements CustomerTokenCodec {
  generate(): GeneratedToken {
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: this.hash(raw) };
  }

  hash(raw: string): string {
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }
}
