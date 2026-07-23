import { InvalidCustomerAuthTokenError, InvalidCustomerSessionError } from './errors.js';
import { normalizeCustomerIdentifier } from './customer-identifier.js';
import type {
  AuditRecorder,
  Clock,
  CustomerAuthContext,
  CustomerAuthRecord,
  CustomerAuthRepository,
  CustomerLoginTokenRepository,
  CustomerPiiHasher,
  CustomerSessionRepository,
  CustomerTokenCodec,
  MagicLinkSender,
} from './ports.js';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CustomerAuthServiceDeps {
  companyId: string;
  customers: CustomerAuthRepository;
  loginTokens: CustomerLoginTokenRepository;
  sessions: CustomerSessionRepository;
  codec: CustomerTokenCodec;
  piiHasher: CustomerPiiHasher;
  sender: MagicLinkSender;
  audit: AuditRecorder;
  clock: Clock;
  magicLinkTtlMin: number;
  sessionTtlDays: number;
}

export interface CustomerDto {
  name: string | null;
  phone: string | null;
  email: string | null;
  municipality: string | null;
}

export interface CustomerSessionResult {
  sessionToken: string;
  expiresAt: string;
  customer: CustomerDto;
}

/**
 * Passwordless customer authentication. Tenant identity is fixed by the
 * composition root; no request field can choose or override companyId.
 */
export class CustomerAuthService {
  constructor(private readonly deps: CustomerAuthServiceDeps) {}

  async requestAccess(input: { identifier: string; ipHash: string | null }): Promise<void> {
    const identifier = normalizeCustomerIdentifier(input.identifier);
    const customer = await this.findCustomer(identifier);
    const identifierHash = this.deps.piiHasher.hash(identifier.value, 'identifier');

    if (!customer || identifier.kind === 'unknown') {
      await this.deps.audit.record({
        actorType: 'SYSTEM',
        action: 'customer_auth.requested',
        entity: 'customer',
        entityId: 'unknown',
        data: { delivered: false, identifierHash, ipHash: input.ipHash },
      });
      return;
    }

    const generated = this.deps.codec.generate();
    const expiresAt = new Date(
      this.deps.clock.now().getTime() + this.deps.magicLinkTtlMin * MINUTE_MS,
    );
    await this.deps.loginTokens.create({
      companyId: this.deps.companyId,
      customerId: customer.id,
      tokenHash: generated.hash,
      expiresAt,
      ipHash: input.ipHash,
    });
    let delivered = true;
    try {
      await this.deps.sender.send({
        companyId: this.deps.companyId,
        customerId: customer.id,
        channel: identifier.kind,
        destination: identifier.value,
        token: generated.raw,
        expiresAt,
      });
    } catch {
      // The public response remains generic even when a provider is down, so
      // delivery failures cannot be used to enumerate customer accounts.
      delivered = false;
    }
    await this.deps.audit.record({
      actorType: 'SYSTEM',
      action: 'customer_auth.requested',
      entity: 'customer',
      entityId: customer.id,
      data: { delivered, identifierHash, ipHash: input.ipHash },
    });
  }

  async verify(input: {
    token: string;
    ipHash: string | null;
    userAgent: string | null;
  }): Promise<CustomerSessionResult> {
    const now = this.deps.clock.now();
    const session = this.deps.codec.generate();
    const expiresAt = new Date(now.getTime() + this.deps.sessionTtlDays * DAY_MS);
    const customer = await this.deps.loginTokens.exchange({
      companyId: this.deps.companyId,
      loginTokenHash: this.deps.codec.hash(input.token),
      sessionTokenHash: session.hash,
      sessionExpiresAt: expiresAt,
      now,
      ipHash: input.ipHash,
      userAgent: input.userAgent,
    });
    if (!customer) {
      await this.deps.audit.record({
        actorType: 'SYSTEM',
        action: 'customer_auth.login.failed',
        entity: 'customer',
        entityId: 'unknown',
        data: { ipHash: input.ipHash },
      });
      throw new InvalidCustomerAuthTokenError();
    }

    return {
      sessionToken: session.raw,
      expiresAt: expiresAt.toISOString(),
      customer: toDto(customer),
    };
  }

  async authenticate(rawToken: string): Promise<CustomerAuthContext> {
    const now = this.deps.clock.now();
    const stored = await this.deps.sessions.findByHash(
      this.deps.companyId,
      this.deps.codec.hash(rawToken),
    );
    if (!stored || stored.revokedAt !== null || stored.expiresAt.getTime() <= now.getTime()) {
      throw new InvalidCustomerSessionError();
    }
    await this.deps.sessions.touch(stored.companyId, stored.id, now);
    return {
      companyId: stored.companyId,
      customerId: stored.customerId,
      sessionId: stored.id,
    };
  }

  async me(ctx: CustomerAuthContext): Promise<CustomerDto> {
    const customer = await this.deps.customers.findById(ctx.companyId, ctx.customerId);
    if (!customer) throw new InvalidCustomerSessionError();
    return toDto(customer);
  }

  async logout(rawToken: string, ctx: CustomerAuthContext): Promise<void> {
    await this.deps.sessions.revoke(
      ctx.companyId,
      this.deps.codec.hash(rawToken),
      this.deps.clock.now(),
    );
    await this.deps.audit.record({
      actorType: 'CUSTOMER',
      actorId: ctx.customerId,
      action: 'customer_auth.logout',
      entity: 'customer',
      entityId: ctx.customerId,
    });
  }

  private async findCustomer(
    identifier: ReturnType<typeof normalizeCustomerIdentifier>,
  ): Promise<CustomerAuthRecord | null> {
    if (identifier.kind === 'email') {
      return this.deps.customers.findByEmail(this.deps.companyId, identifier.value);
    }
    if (identifier.kind === 'phone') {
      return this.deps.customers.findByPhone(this.deps.companyId, identifier.value);
    }
    return null;
  }
}

function toDto(customer: CustomerAuthRecord): CustomerDto {
  return {
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    municipality: customer.municipality,
  };
}
