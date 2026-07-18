import {
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type BinaryLike,
  type ScryptOptions,
} from 'node:crypto';
import { promisify } from 'node:util';
import type { PasswordHasher } from '../application/ports.js';

// promisify resolves scrypt's no-options overload, so type the options form explicitly.
const scrypt = promisify(scryptCb) as (
  password: BinaryLike,
  salt: BinaryLike,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

// scrypt cost parameters. N must be a power of two; these are OWASP-aligned
// defaults for interactive login (≈64 MB, tens of ms on a modern CPU).
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const SALT_BYTES = 16;

/**
 * Password hashing built on Node's native scrypt — no third-party dependency
 * and no native build step, so it behaves identically on local machines and
 * the Debian production container. Encoded format:
 *   scrypt$N$r$p$<saltB64>$<hashB64>
 */
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const derived = (await scrypt(plain, salt, KEYLEN, { N, r: R, p: P })) as Buffer;
    return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${derived.toString('base64')}`;
  }

  async verify(plain: string, stored: string | null): Promise<boolean> {
    // Verify against a dummy hash for missing/blank values so timing does not
    // leak whether an account (and password) exists.
    const encoded = stored && stored.length > 0 ? stored : DUMMY_HASH;
    const parsed = parse(encoded);
    if (!parsed) {
      return false;
    }
    const derived = (await scrypt(plain, parsed.salt, parsed.hash.length, {
      N: parsed.n,
      r: parsed.r,
      p: parsed.p,
    })) as Buffer;
    const match = derived.length === parsed.hash.length && timingSafeEqual(derived, parsed.hash);
    // Never report a match when the real stored value was absent.
    return match && stored !== null && stored.length > 0;
  }
}

interface ParsedHash {
  n: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
}

function parse(encoded: string): ParsedHash | null {
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return null;
  }
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return null;
  }
  return {
    n,
    r,
    p,
    salt: Buffer.from(parts[4] ?? '', 'base64'),
    hash: Buffer.from(parts[5] ?? '', 'base64'),
  };
}

// A fixed, well-formed hash of a random value, used only to equalize timing
// for absent passwords. Its plaintext is unknown and irrelevant.
const DUMMY_HASH = `scrypt$${N}$${R}$${P}$${randomBytes(SALT_BYTES).toString('base64')}$${randomBytes(
  KEYLEN,
).toString('base64')}`;
