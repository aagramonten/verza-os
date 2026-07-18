import { describe, expect, it } from 'vitest';
import { MoneyError, computeCostTotalCents } from '../../src/modules/financials/domain/money.js';

describe('computeCostTotalCents', () => {
  it('multiplies whole quantities', () => {
    expect(computeCostTotalCents(3, 1000)).toBe(3000);
    expect(computeCostTotalCents(1, 500)).toBe(500);
  });

  it('handles fractional quantities and rounds to whole cents', () => {
    expect(computeCostTotalCents(2.5, 200)).toBe(500);
    expect(computeCostTotalCents(0.333, 100)).toBe(33); // 0.333 * 100 = 33.3 → 33
    expect(computeCostTotalCents(1.005, 100)).toBe(101); // 1.005 * 100 = 100.5 → 101
  });

  it('returns 0 for a zero quantity or zero unit cost', () => {
    expect(computeCostTotalCents(0, 500)).toBe(0);
    expect(computeCostTotalCents(5, 0)).toBe(0);
  });

  it('rejects negative quantity or a non-integer unit cost', () => {
    expect(() => computeCostTotalCents(-1, 100)).toThrow(MoneyError);
    expect(() => computeCostTotalCents(1, 10.5)).toThrow(MoneyError);
    expect(() => computeCostTotalCents(1, -100)).toThrow(MoneyError);
  });
});
