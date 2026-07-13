import type { UserRole } from '@prisma/client';

/**
 * The authenticated caller, derived exclusively from a verified access token.
 * `companyId` here is authoritative for tenant scoping — it is NEVER read from
 * a request header or body (AGENTS.md §Data And Tenant Safety).
 */
export interface AuthContext {
  userId: string;
  companyId: string;
  role: UserRole;
}

/** Internal user record (includes the password hash — never returned to clients). */
export interface UserRecord {
  id: string;
  companyId: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string | null;
}

/** Safe, client-facing shape of a user. No password hash, no internals. */
export interface UserDto {
  id: string;
  companyId: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface Clock {
  now(): Date;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  /** Constant-time verification. Returns false for a null/blank stored hash. */
  verify(plain: string, stored: string | null): Promise<boolean>;
}

export interface IssuedAccessToken {
  token: string;
  expiresInSec: number;
}

export interface AccessTokenIssuer {
  issue(ctx: AuthContext): IssuedAccessToken;
  /** Throws InvalidAccessTokenError on any tampering, wrong type, or expiry. */
  verify(token: string): AuthContext;
}

export interface GeneratedRefreshToken {
  /** The opaque token handed to the client exactly once. */
  raw: string;
  /** SHA-256 hash stored at rest. */
  hash: string;
}

export interface RefreshTokenCodec {
  generate(): GeneratedRefreshToken;
  hash(raw: string): string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
}

export interface CreateRefreshTokenInput {
  companyId: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string | null;
  ipHash?: string | null;
}

export interface StoredRefreshToken {
  id: string;
  companyId: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface RefreshTokenRepository {
  create(input: CreateRefreshTokenInput): Promise<void>;
  findByHash(tokenHash: string): Promise<StoredRefreshToken | null>;
  /** Mark a single token revoked, optionally recording its replacement hash. */
  revoke(id: string, at: Date, replacedByHash?: string): Promise<void>;
  /** Revoke every non-revoked token in a family (theft response / logout-all). */
  revokeFamily(familyId: string, at: Date): Promise<void>;
}
