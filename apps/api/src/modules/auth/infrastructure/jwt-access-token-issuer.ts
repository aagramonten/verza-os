import { createHmac, timingSafeEqual } from 'node:crypto';
import { UserRole } from '@prisma/client';
import type { AccessTokenIssuer, AuthContext, Clock, IssuedAccessToken } from '../application/ports.js';
import { InvalidAccessTokenError } from '../application/errors.js';

interface AccessTokenPayload {
  sub: string;
  cid: string;
  role: UserRole;
  typ: 'access';
  iat: number;
  exp: number;
}

/**
 * Stateless HS256 access tokens using only node:crypto — no JWT dependency.
 * The token is `base64url(header).base64url(payload).base64url(hmac)`. Only
 * this issuer verifies them; there is no third-party parsing surface.
 */
export class JwtAccessTokenIssuer implements AccessTokenIssuer {
  private readonly ttlSec: number;

  constructor(
    private readonly secret: string,
    accessTtlMin: number,
    private readonly clock: Clock,
  ) {
    this.ttlSec = accessTtlMin * 60;
  }

  issue(ctx: AuthContext): IssuedAccessToken {
    const iat = Math.floor(this.clock.now().getTime() / 1000);
    const payload: AccessTokenPayload = {
      sub: ctx.userId,
      cid: ctx.companyId,
      role: ctx.role,
      typ: 'access',
      iat,
      exp: iat + this.ttlSec,
    };
    const signingInput = `${encode(HEADER)}.${encode(payload)}`;
    const signature = this.sign(signingInput);
    return { token: `${signingInput}.${signature}`, expiresInSec: this.ttlSec };
  }

  verify(token: string): AuthContext {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new InvalidAccessTokenError();
    }
    const [header, payload, signature] = parts as [string, string, string];

    const expected = this.sign(`${header}.${payload}`);
    if (!constantTimeEquals(signature, expected)) {
      throw new InvalidAccessTokenError();
    }

    const claims = decode(payload);
    if (
      claims === null ||
      claims.typ !== 'access' ||
      typeof claims.sub !== 'string' ||
      typeof claims.cid !== 'string' ||
      typeof claims.exp !== 'number' ||
      !isUserRole(claims.role)
    ) {
      throw new InvalidAccessTokenError();
    }

    const nowSec = Math.floor(this.clock.now().getTime() / 1000);
    if (claims.exp <= nowSec) {
      throw new InvalidAccessTokenError('Access token expired');
    }

    return { userId: claims.sub, companyId: claims.cid, role: claims.role };
  }

  private sign(input: string): string {
    return createHmac('sha256', this.secret).update(input).digest('base64url');
  }
}

const HEADER = { alg: 'HS256', typ: 'JWT' } as const;

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decode(segment: string): Partial<AccessTokenPayload> | null {
  try {
    const json = Buffer.from(segment, 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Partial<AccessTokenPayload>)
      : null;
  } catch {
    return null;
  }
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function isUserRole(value: unknown): value is UserRole {
  return value === UserRole.OWNER || value === UserRole.ADMIN;
}
