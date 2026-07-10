import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ResumeTokenService } from '../../src/modules/chat/application/resume-token.service.js';

describe('resume token service', () => {
  const service = new ResumeTokenService();

  it('generates url-safe tokens with 256 bits of entropy', () => {
    const { rawToken } = service.generate();
    expect(rawToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(rawToken, 'base64url')).toHaveLength(32);
  });

  it('never emits the same token twice', () => {
    const seen = new Set(Array.from({ length: 200 }, () => service.generate().rawToken));
    expect(seen.size).toBe(200);
  });

  it('returns the sha-256 hash of the raw token — nothing reversible', () => {
    const { rawToken, tokenHash } = service.generate();
    expect(tokenHash).toBe(createHash('sha256').update(rawToken, 'utf8').digest('hex'));
    expect(tokenHash).not.toContain(rawToken);
  });

  it('verifies a matching token and rejects any other', () => {
    const { rawToken, tokenHash } = service.generate();
    expect(service.verify(rawToken, tokenHash)).toBe(true);
    expect(service.verify(rawToken.slice(0, -1) + '!', tokenHash)).toBe(false);
    expect(service.verify('completely-wrong', tokenHash)).toBe(false);
    expect(service.verify('', tokenHash)).toBe(false);
  });
});
