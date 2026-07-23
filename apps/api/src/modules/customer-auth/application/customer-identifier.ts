import { normalizePhone } from '../../../shared/phone/normalize.js';

export type NormalizedCustomerIdentifier =
  | { kind: 'email'; value: string }
  | { kind: 'phone'; value: string }
  | { kind: 'unknown'; value: string };

/**
 * Produces one canonical identifier for both customer lookup and privacy-safe
 * rate-limit/audit hashing. Invalid values remain non-sensitive opaque input
 * and never become a customer lookup.
 */
export function normalizeCustomerIdentifier(identifier: string): NormalizedCustomerIdentifier {
  const trimmed = identifier.trim();
  if (trimmed.includes('@')) {
    return { kind: 'email', value: trimmed.toLowerCase() };
  }
  const phone = normalizePhone(trimmed);
  return phone
    ? { kind: 'phone', value: phone.e164 }
    : { kind: 'unknown', value: trimmed.toLowerCase() };
}
