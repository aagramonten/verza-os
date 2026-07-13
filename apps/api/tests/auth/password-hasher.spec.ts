import { describe, expect, it } from 'vitest';
import { ScryptPasswordHasher } from '../../src/modules/auth/infrastructure/scrypt-password-hasher.js';

describe('ScryptPasswordHasher', () => {
  const hasher = new ScryptPasswordHasher();

  it('produces an encoded scrypt string and verifies the same password', async () => {
    const hash = await hasher.hash('correct horse battery');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(hash.split('$')).toHaveLength(6);
    await expect(hasher.verify('correct horse battery', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hasher.hash('secret-value');
    await expect(hasher.verify('secret-valuE', hash)).resolves.toBe(false);
  });

  it('salts each hash so identical passwords differ', async () => {
    const a = await hasher.hash('same-password');
    const b = await hasher.hash('same-password');
    expect(a).not.toEqual(b);
  });

  it('returns false for a null or blank stored hash', async () => {
    await expect(hasher.verify('anything', null)).resolves.toBe(false);
    await expect(hasher.verify('anything', '')).resolves.toBe(false);
  });

  it('returns false for a malformed stored hash', async () => {
    await expect(hasher.verify('anything', 'not-a-scrypt-hash')).resolves.toBe(false);
  });
});
