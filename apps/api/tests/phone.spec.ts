import { describe, expect, it } from 'vitest';
import { normalizePhone } from '../src/shared/phone/normalize.js';

describe('PR phone normalization', () => {
  it.each([
    ['7875551234', '+17875551234'],
    ['787-555-1234', '+17875551234'],
    ['(939) 555-1234', '+19395551234'],
    ['19395551234', '+19395551234'],
    ['+1 787 555 1234', '+17875551234'],
    ['1 (787) 555-1234', '+17875551234'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizePhone(input)?.e164).toBe(expected);
  });

  it.each([['abc'], [''], ['123'], ['555-1234-9999-9999']])('rejects invalid input %s', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});
