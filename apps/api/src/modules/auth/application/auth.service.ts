import { randomUUID } from 'node:crypto';
import type {
  AccessTokenIssuer,
  AuthContext,
  Clock,
  PasswordHasher,
  RefreshTokenCodec,
  RefreshTokenRepository,
  UserDto,
  UserRecord,
  UserRepository,
} from './ports.js';
import {
  InvalidAccessTokenError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  RefreshTokenReuseError,
} from './errors.js';

/** Minimal append-only audit port; satisfied by the shared AuditLogService. */
export interface AuditRecorder {
  record(entry: {
    actorType: 'ADMIN' | 'SYSTEM';
    actorId?: string;
    action: string;
    entity: string;
    entityId: string;
    data?: Record<string, unknown>;
  }): Promise<void>;
}

export interface AuthServiceDeps {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
  hasher: PasswordHasher;
  issuer: AccessTokenIssuer;
  refreshCodec: RefreshTokenCodec;
  clock: Clock;
  audit: AuditRecorder;
  refreshTtlDays: number;
}

export interface RequestMeta {
  ipHash?: string | null;
  userAgent?: string | null;
}

export interface AuthResult {
  accessToken: string;
  /** Access-token lifetime in seconds (for client refresh scheduling). */
  expiresInSec: number;
  refreshToken: string;
  user: UserDto;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Owner/admin console authentication. Password login issues a short-lived
 * stateless access token plus an opaque, rotating refresh token. All token
 * state lives server-side; the client only holds bearer strings.
 */
export class AuthService {
  constructor(private readonly deps: AuthServiceDeps) {}

  async login(
    input: { email: string; password: string } & RequestMeta,
  ): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    const user = await this.deps.users.findByEmail(email);
    // Always run the hash comparison (even for an unknown email) so response
    // timing does not reveal whether the account exists.
    const ok = await this.deps.hasher.verify(input.password, user?.passwordHash ?? null);

    if (!user || !ok) {
      await this.deps.audit.record({
        actorType: 'SYSTEM',
        action: 'auth.login.failure',
        entity: 'user',
        entityId: user?.id ?? 'unknown',
        data: { email, ipHash: input.ipHash ?? null },
      });
      throw new InvalidCredentialsError();
    }

    const result = await this.issueSession(user, randomUUID(), input);
    await this.deps.audit.record({
      actorType: 'ADMIN',
      actorId: user.id,
      action: 'auth.login.success',
      entity: 'user',
      entityId: user.id,
      data: { ipHash: input.ipHash ?? null },
    });
    return result;
  }

  async refresh(input: { refreshToken: string } & RequestMeta): Promise<AuthResult> {
    const now = this.deps.clock.now();
    const tokenHash = this.deps.refreshCodec.hash(input.refreshToken);
    const stored = await this.deps.refreshTokens.findByHash(tokenHash);

    if (!stored) {
      throw new InvalidRefreshTokenError();
    }

    if (stored.revokedAt !== null) {
      // A previously rotated token is being replayed → revoke the whole family.
      await this.deps.refreshTokens.revokeFamily(stored.familyId, now);
      await this.deps.audit.record({
        actorType: 'SYSTEM',
        action: 'auth.refresh.reuse_detected',
        entity: 'user',
        entityId: stored.userId,
        data: { familyId: stored.familyId, ipHash: input.ipHash ?? null },
      });
      throw new RefreshTokenReuseError();
    }

    if (stored.expiresAt.getTime() <= now.getTime()) {
      throw new InvalidRefreshTokenError();
    }

    const user = await this.deps.users.findById(stored.userId);
    if (!user) {
      throw new InvalidRefreshTokenError();
    }

    return this.issueSession(user, stored.familyId, input, {
      rotateFrom: { id: stored.id, at: now },
    });
  }

  async logout(input: { refreshToken: string }): Promise<void> {
    const now = this.deps.clock.now();
    const tokenHash = this.deps.refreshCodec.hash(input.refreshToken);
    const stored = await this.deps.refreshTokens.findByHash(tokenHash);
    // Idempotent: unknown or already-revoked tokens are a no-op.
    if (stored && stored.revokedAt === null) {
      await this.deps.refreshTokens.revoke(stored.id, now);
    }
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.deps.users.findById(userId);
    if (!user) {
      throw new InvalidAccessTokenError();
    }
    return toDto(user);
  }

  private async issueSession(
    user: UserRecord,
    familyId: string,
    meta: RequestMeta,
    options: { rotateFrom?: { id: string; at: Date } } = {},
  ): Promise<AuthResult> {
    const ctx: AuthContext = {
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
    };
    const access = this.deps.issuer.issue(ctx);
    const refresh = this.deps.refreshCodec.generate();
    const expiresAt = new Date(this.deps.clock.now().getTime() + this.deps.refreshTtlDays * DAY_MS);

    await this.deps.refreshTokens.create({
      companyId: user.companyId,
      userId: user.id,
      familyId,
      tokenHash: refresh.hash,
      expiresAt,
      userAgent: meta.userAgent ?? null,
      ipHash: meta.ipHash ?? null,
    });

    // Rotation: mark the presented token revoked only AFTER the replacement is
    // safely persisted, recording the new hash for the audit trail.
    if (options.rotateFrom) {
      await this.deps.refreshTokens.revoke(
        options.rotateFrom.id,
        options.rotateFrom.at,
        refresh.hash,
      );
    }

    return {
      accessToken: access.token,
      expiresInSec: access.expiresInSec,
      refreshToken: refresh.raw,
      user: toDto(user),
    };
  }
}

function toDto(user: UserRecord): UserDto {
  return {
    id: user.id,
    companyId: user.companyId,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}
