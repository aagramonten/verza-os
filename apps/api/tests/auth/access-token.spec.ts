import { describe, expect, it } from 'vitest';
import { JwtAccessTokenIssuer } from '../../src/modules/auth/infrastructure/jwt-access-token-issuer.js';
import { InvalidAccessTokenError } from '../../src/modules/auth/application/errors.js';
import type { AuthContext, Clock } from '../../src/modules/auth/application/ports.js';

class FixedClock implements Clock {
  constructor(public current: Date) {}
  now(): Date {
    return this.current;
  }
}

const SECRET = 'unit-test-secret-unit-test-secret-0123456789';
const CTX: AuthContext = {
  userId: '11111111-1111-1111-1111-111111111111',
  companyId: '22222222-2222-2222-2222-222222222222',
  role: 'OWNER',
};

describe('JwtAccessTokenIssuer', () => {
  it('issues a verifiable token that round-trips the auth context', () => {
    const issuer = new JwtAccessTokenIssuer(SECRET, 15, new FixedClock(new Date()));
    const { token, expiresInSec } = issuer.issue(CTX);
    expect(expiresInSec).toBe(15 * 60);
    expect(token.split('.')).toHaveLength(3);
    expect(issuer.verify(token)).toEqual(CTX);
  });

  it('rejects a token signed with a different secret', () => {
    const good = new JwtAccessTokenIssuer(SECRET, 15, new FixedClock(new Date()));
    const evil = new JwtAccessTokenIssuer(`${SECRET}-other`, 15, new FixedClock(new Date()));
    const { token } = evil.issue(CTX);
    expect(() => good.verify(token)).toThrow(InvalidAccessTokenError);
  });

  it('rejects a tampered payload', () => {
    const issuer = new JwtAccessTokenIssuer(SECRET, 15, new FixedClock(new Date()));
    const { token } = issuer.issue(CTX);
    const [header, , signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ ...CTX, role: 'ADMIN' }), 'utf8').toString(
      'base64url',
    );
    expect(() => issuer.verify(`${header}.${forged}.${signature}`)).toThrow(InvalidAccessTokenError);
  });

  it('rejects an expired token', () => {
    const clock = new FixedClock(new Date('2026-01-01T00:00:00Z'));
    const issuer = new JwtAccessTokenIssuer(SECRET, 15, clock);
    const { token } = issuer.issue(CTX);
    clock.current = new Date('2026-01-01T00:16:00Z'); // 16 min later > 15 min TTL
    expect(() => issuer.verify(token)).toThrow(InvalidAccessTokenError);
  });

  it('rejects a malformed token', () => {
    const issuer = new JwtAccessTokenIssuer(SECRET, 15, new FixedClock(new Date()));
    expect(() => issuer.verify('not.a.token')).toThrow(InvalidAccessTokenError);
    expect(() => issuer.verify('garbage')).toThrow(InvalidAccessTokenError);
  });
});
