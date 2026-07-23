import { createHmac } from 'node:crypto';
import type { CustomerPiiHasher } from '../application/ports.js';

/**
 * Pseudonymizes low-entropy customer data with a keyed digest. Domain
 * separation prevents hashes from being correlated across purposes.
 */
export class HmacCustomerPiiHasher implements CustomerPiiHasher {
  constructor(private readonly secret: string) {}

  hash(value: string, purpose: 'identifier' | 'ip'): string {
    return createHmac('sha256', this.secret)
      .update(`customer-auth:${purpose}:`, 'utf8')
      .update(value, 'utf8')
      .digest('hex');
  }
}
