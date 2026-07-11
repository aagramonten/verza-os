import { describe, expect, it } from 'vitest';
import {
  clampBudgetCents,
  computeSquareFeet,
  validateDesiredDate,
  validateEmail,
} from '../../src/modules/chat/application/field-validation.js';

describe('application-code field validation', () => {
  it('computes square footage (never trusting the model)', () => {
    expect(computeSquareFeet(22, 3)).toBe(66);
    expect(computeSquareFeet(10.5, 4)).toBe(42);
    expect(computeSquareFeet(null, 3)).toBeNull();
    expect(computeSquareFeet(0, 3)).toBeNull();
    expect(computeSquareFeet(20_000, 3)).toBeNull(); // out of bounds
  });

  it('validates email', () => {
    expect(validateEmail('Ana@Example.COM')).toBe('ana@example.com');
    expect(validateEmail('not-an-email')).toBeNull();
    expect(validateEmail(null)).toBeNull();
  });

  it('validates desired date and rejects garbage/absurd dates', () => {
    const now = new Date('2026-07-10T00:00:00Z');
    expect(validateDesiredDate('2026-09-01', now)).toBe('2026-09-01');
    expect(validateDesiredDate('el mes que viene', now)).toBeNull();
    expect(validateDesiredDate('1990-01-01', now)).toBeNull();
    expect(validateDesiredDate('2050-01-01', now)).toBeNull();
  });

  it('clamps budget cents', () => {
    expect(clampBudgetCents(50_000)).toBe(50_000);
    expect(clampBudgetCents(-1)).toBeNull();
    expect(clampBudgetCents(5.5)).toBeNull();
    expect(clampBudgetCents(200_000_000)).toBeNull();
  });
});
