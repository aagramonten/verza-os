import { describe, expect, it } from 'vitest';
import { averageCents, meetsGoal, percent } from '../../src/modules/financials/domain/metrics.js';

describe('financial metrics helpers', () => {
  it('calculates rounded percentages and guards zero denominators', () => {
    expect(percent(220000, 300000)).toBe(73.3);
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(100, 0)).toBeNull();
  });

  it('calculates integer-cent averages and goal status deterministically', () => {
    expect(averageCents(100001, 2)).toBe(50001);
    expect(averageCents(100001, 0)).toBeNull();
    expect(meetsGoal(230000, 230000)).toBe(true);
    expect(meetsGoal(null, 1)).toBe(false);
  });
});
