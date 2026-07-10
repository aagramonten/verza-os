import { parsePhoneNumberFromString } from 'libphonenumber-js';

export interface NormalizedPhone {
  e164: string;
  national: string;
}

/**
 * Normalize a customer-provided phone number to E.164, defaulting to Puerto
 * Rico. Accepts local 7-digit-less formats like "787-555-1234", "9395551234",
 * "+1 787 555 1234", or "1 (939) 555-1234". Returns null when the input is
 * not a valid PR/US number — callers must re-ask, never store raw input.
 */
export function normalizePhone(raw: string): NormalizedPhone | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = parsePhoneNumberFromString(trimmed, 'PR');
  if (!parsed || !parsed.isValid()) {
    return null;
  }

  return {
    e164: parsed.number,
    national: parsed.formatNational(),
  };
}
