/**
 * Deterministic money helpers. All amounts are integer cents (AGENTS.md
 * §Money). No floating-point money is ever stored; the only float in the
 * system is a cost's quantity (up to 3 decimals), and its product with a
 * unit price is immediately rounded back to integer cents here.
 */

export class MoneyError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'MoneyError';
  }
}

/**
 * Line total for a cost entry: quantity × unit price, rounded to the nearest
 * cent (round-half-up). The server always computes this — a client-supplied
 * total is never trusted (AGENTS.md: the client never decides money).
 */
export function computeCostTotalCents(quantity: number, unitCostCents: number): number {
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new MoneyError('quantity must be a non-negative number');
  }
  if (!Number.isInteger(unitCostCents) || unitCostCents < 0) {
    throw new MoneyError('unitCostCents must be a non-negative integer');
  }
  // Work in thousandths of a cent to keep the rounding deterministic given
  // quantity has at most 3 decimal places, then round to whole cents.
  const milliCents = Math.round(quantity * 1000) * unitCostCents;
  return Math.round(milliCents / 1000);
}
