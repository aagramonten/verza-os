export interface Clock {
  now(): Date;
}

export interface CustomerAuthContext {
  companyId: string;
  customerId: string;
  sessionId: string;
}

export interface CustomerAuthRecord {
  id: string;
  companyId: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  municipality: string | null;
}

export interface CustomerAuthRepository {
  findByEmail(companyId: string, email: string): Promise<CustomerAuthRecord | null>;
  findByPhone(companyId: string, phone: string): Promise<CustomerAuthRecord | null>;
  findById(companyId: string, customerId: string): Promise<CustomerAuthRecord | null>;
}

export interface CreateLoginTokenInput {
  companyId: string;
  customerId: string;
  tokenHash: string;
  expiresAt: Date;
  ipHash: string | null;
}

export interface CustomerLoginTokenRepository {
  create(input: CreateLoginTokenInput): Promise<void>;
  /**
   * Atomically consumes a valid login token, creates its customer session,
   * and appends the successful-login audit evidence.
   */
  exchange(input: ExchangeLoginTokenInput): Promise<CustomerAuthRecord | null>;
}

export interface ExchangeLoginTokenInput {
  companyId: string;
  loginTokenHash: string;
  sessionTokenHash: string;
  sessionExpiresAt: Date;
  now: Date;
  ipHash: string | null;
  userAgent: string | null;
}

export interface StoredCustomerSession {
  id: string;
  companyId: string;
  customerId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface CustomerSessionRepository {
  findByHash(companyId: string, tokenHash: string): Promise<StoredCustomerSession | null>;
  touch(companyId: string, id: string, at: Date): Promise<void>;
  revoke(companyId: string, tokenHash: string, at: Date): Promise<void>;
}

export interface GeneratedToken {
  raw: string;
  hash: string;
}

export interface CustomerTokenCodec {
  generate(): GeneratedToken;
  hash(raw: string): string;
}

export interface CustomerPiiHasher {
  hash(value: string, purpose: 'identifier' | 'ip'): string;
}

export interface MagicLinkSender {
  send(input: {
    companyId: string;
    customerId: string;
    channel: 'email' | 'phone';
    destination: string;
    token: string;
    expiresAt: Date;
  }): Promise<void>;
}

export interface RateLimiter {
  hit(key: string): { allowed: boolean; retryAfterSeconds: number };
}

export interface AuditRecorder {
  record(entry: {
    actorType: 'CUSTOMER' | 'SYSTEM';
    actorId?: string;
    action: string;
    entity: string;
    entityId: string;
    data?: Record<string, unknown>;
  }): Promise<void>;
}
