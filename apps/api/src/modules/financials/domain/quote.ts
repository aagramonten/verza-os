export const MYSQL_SIGNED_INT_MAX = 2_147_483_647;
export const MAX_QUANTITY_MILLI = MYSQL_SIGNED_INT_MAX;
export const MAX_QUOTE_LINE_ITEMS = 100;

const MILLI_PER_UNIT = 1_000n;
const BASIS_POINTS_PER_WHOLE = 10_000n;

export type QuoteWorkflowStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SENT'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'SUPERSEDED';

export type QuoteWorkflowAction = 'SUBMIT_FOR_APPROVAL' | 'APPROVE' | 'SEND' | 'REQUOTE';

export type QuoteWorkflowActor =
  | {
      kind: 'HUMAN';
      role: 'OWNER' | 'ADMIN';
      actorId: string;
    }
  | {
      kind: 'AI' | 'SYSTEM';
      actorId?: string;
    };

export type QuoteDomainErrorCode =
  | 'EMPTY_LINE_ITEMS'
  | 'TOO_MANY_LINE_ITEMS'
  | 'INVALID_DESCRIPTION'
  | 'INVALID_QUANTITY'
  | 'INVALID_UNIT_PRICE'
  | 'INVALID_TAX_RATE'
  | 'MONEY_OVERFLOW'
  | 'INVALID_TRANSITION'
  | 'HUMAN_ACTOR_REQUIRED';

export class QuoteDomainError extends Error {
  constructor(
    public readonly code: QuoteDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'QuoteDomainError';
  }
}

export interface QuoteLineItemInput {
  description: string;
  /**
   * Exact quantity in thousandths of a unit.
   * Examples: 1 unit = 1000; 2.5 units = 2500.
   */
  quantityMilli: number;
  unitPriceCents: number;
}

export interface PricedQuoteLineItem {
  description: string;
  quantityMilli: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface QuotePricingInput {
  lineItems: readonly QuoteLineItemInput[];
  /** 1% = 100 basis points. Must be an integer from 0 through 10_000. */
  taxRateBps: number;
}

export interface QuotePricingResult {
  lineItems: PricedQuoteLineItem[];
  subtotalCents: number;
  taxRateBps: number;
  taxCents: number;
  totalCents: number;
}

/**
 * Prices an immutable quote snapshot using integer arithmetic only.
 *
 * Multiplication and rounding happen as BigInt, so no binary floating-point
 * value participates in money calculations. Fractional cents are rounded
 * half-up after each line and again for tax.
 */
export function priceQuote(input: QuotePricingInput): QuotePricingResult {
  if (input.lineItems.length === 0) {
    throw new QuoteDomainError('EMPTY_LINE_ITEMS', 'A quote requires at least one line item');
  }
  if (input.lineItems.length > MAX_QUOTE_LINE_ITEMS) {
    throw new QuoteDomainError(
      'TOO_MANY_LINE_ITEMS',
      `A quote supports at most ${MAX_QUOTE_LINE_ITEMS} line items`,
    );
  }
  assertIntegerInRange(
    input.taxRateBps,
    0,
    Number(BASIS_POINTS_PER_WHOLE),
    'INVALID_TAX_RATE',
    'taxRateBps',
  );

  let subtotal = 0n;
  const pricedLineItems = input.lineItems.map((lineItem) => {
    const description = lineItem.description.trim();
    if (description.length === 0) {
      throw new QuoteDomainError('INVALID_DESCRIPTION', 'Line item description must not be empty');
    }
    assertIntegerInRange(
      lineItem.quantityMilli,
      1,
      MAX_QUANTITY_MILLI,
      'INVALID_QUANTITY',
      'quantityMilli',
    );
    assertIntegerInRange(
      lineItem.unitPriceCents,
      0,
      MYSQL_SIGNED_INT_MAX,
      'INVALID_UNIT_PRICE',
      'unitPriceCents',
    );

    const milliCents = BigInt(lineItem.quantityMilli) * BigInt(lineItem.unitPriceCents);
    const lineTotal = roundHalfUp(milliCents, MILLI_PER_UNIT);
    assertMoneyFits(lineTotal, 'Line total');
    subtotal += lineTotal;
    assertMoneyFits(subtotal, 'Quote subtotal');

    return {
      description,
      quantityMilli: lineItem.quantityMilli,
      unitPriceCents: lineItem.unitPriceCents,
      lineTotalCents: Number(lineTotal),
    };
  });

  const tax = roundHalfUp(subtotal * BigInt(input.taxRateBps), BASIS_POINTS_PER_WHOLE);
  assertMoneyFits(tax, 'Quote tax');
  const total = subtotal + tax;
  assertMoneyFits(total, 'Quote total');

  return {
    lineItems: pricedLineItems,
    subtotalCents: Number(subtotal),
    taxRateBps: input.taxRateBps,
    taxCents: Number(tax),
    totalCents: Number(total),
  };
}

/**
 * Single entry point for the supported quote workflow. SUPERSEDED is never a
 * caller-selected target; it can only be produced by the explicit REQUOTE
 * action.
 */
export function transitionQuote(
  status: QuoteWorkflowStatus,
  action: QuoteWorkflowAction,
  actor?: QuoteWorkflowActor | null,
): QuoteWorkflowStatus {
  if (action === 'APPROVE' || action === 'SEND') {
    assertHumanOwnerOrAdmin(actor);
  }

  if (action === 'SUBMIT_FOR_APPROVAL' && status === 'DRAFT') {
    return 'PENDING_APPROVAL';
  }
  if (action === 'APPROVE' && status === 'PENDING_APPROVAL') {
    return 'APPROVED';
  }
  if (action === 'SEND' && status === 'APPROVED') {
    return 'SENT';
  }
  if (action === 'REQUOTE' && canRequote(status)) {
    return 'SUPERSEDED';
  }

  throw new QuoteDomainError(
    'INVALID_TRANSITION',
    `Cannot ${action.toLowerCase()} a quote in ${status} status`,
  );
}

function canRequote(status: QuoteWorkflowStatus): boolean {
  return (
    status === 'DRAFT' ||
    status === 'PENDING_APPROVAL' ||
    status === 'APPROVED' ||
    status === 'SENT' ||
    status === 'REJECTED' ||
    status === 'EXPIRED'
  );
}

function assertHumanOwnerOrAdmin(actor: QuoteWorkflowActor | null | undefined): void {
  if (
    actor?.kind !== 'HUMAN' ||
    (actor.role !== 'OWNER' && actor.role !== 'ADMIN') ||
    actor.actorId.trim().length === 0
  ) {
    throw new QuoteDomainError(
      'HUMAN_ACTOR_REQUIRED',
      'A human OWNER or ADMIN is required for this action',
    );
  }
}

function assertIntegerInRange(
  value: number,
  min: number,
  max: number,
  code: QuoteDomainErrorCode,
  field: string,
): void {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new QuoteDomainError(code, `${field} must be a safe integer between ${min} and ${max}`);
  }
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

function assertMoneyFits(value: bigint, label: string): void {
  if (value < 0n || value > BigInt(MYSQL_SIGNED_INT_MAX)) {
    throw new QuoteDomainError('MONEY_OVERFLOW', `${label} exceeds the supported MySQL INT range`);
  }
}
