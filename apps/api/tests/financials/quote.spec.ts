import { describe, expect, it } from 'vitest';
import {
  MAX_QUANTITY_MILLI,
  MAX_QUOTE_LINE_ITEMS,
  MYSQL_SIGNED_INT_MAX,
  QuoteDomainError,
  priceQuote,
  transitionQuote,
  type QuoteWorkflowActor,
} from '../../src/modules/financials/domain/quote.js';

const owner: QuoteWorkflowActor = {
  kind: 'HUMAN',
  role: 'OWNER',
  actorId: 'owner-1',
};
const admin: QuoteWorkflowActor = {
  kind: 'HUMAN',
  role: 'ADMIN',
  actorId: 'admin-1',
};

describe('quote pricing', () => {
  it('prices exact milli-unit quantities and computes tax in integer cents', () => {
    const priced = priceQuote({
      lineItems: [
        {
          description: '  Diseño e instalación  ',
          quantityMilli: 2_500,
          unitPriceCents: 20_000,
        },
        {
          description: 'Plantas',
          quantityMilli: 3_000,
          unitPriceCents: 1_500,
        },
      ],
      taxRateBps: 1_150,
    });

    expect(priced).toEqual({
      lineItems: [
        {
          description: 'Diseño e instalación',
          quantityMilli: 2_500,
          unitPriceCents: 20_000,
          lineTotalCents: 50_000,
        },
        {
          description: 'Plantas',
          quantityMilli: 3_000,
          unitPriceCents: 1_500,
          lineTotalCents: 4_500,
        },
      ],
      subtotalCents: 54_500,
      taxRateBps: 1_150,
      taxCents: 6_268,
      totalCents: 60_768,
    });
  });

  it('rounds fractional cents half-up without floating-point arithmetic', () => {
    const priced = priceQuote({
      lineItems: [
        {
          description: 'Fractional quantity',
          quantityMilli: 1_005,
          unitPriceCents: 100,
        },
      ],
      taxRateBps: 0,
    });

    expect(priced.lineItems[0]?.lineTotalCents).toBe(101);
    expect(priced.totalCents).toBe(101);
  });

  it('supports zero-priced lines and zero tax', () => {
    const priced = priceQuote({
      lineItems: [
        {
          description: 'Courtesy item',
          quantityMilli: 1_000,
          unitPriceCents: 0,
        },
      ],
      taxRateBps: 0,
    });

    expect(priced.subtotalCents).toBe(0);
    expect(priced.taxCents).toBe(0);
    expect(priced.totalCents).toBe(0);
  });

  it.each([
    {
      name: 'an empty collection',
      input: { lineItems: [], taxRateBps: 0 },
      code: 'EMPTY_LINE_ITEMS',
    },
    {
      name: 'an empty description',
      input: {
        lineItems: [{ description: '   ', quantityMilli: 1_000, unitPriceCents: 100 }],
        taxRateBps: 0,
      },
      code: 'INVALID_DESCRIPTION',
    },
    {
      name: 'a negative quantity',
      input: {
        lineItems: [{ description: 'Line', quantityMilli: -1, unitPriceCents: 100 }],
        taxRateBps: 0,
      },
      code: 'INVALID_QUANTITY',
    },
    {
      name: 'a zero quantity',
      input: {
        lineItems: [{ description: 'Line', quantityMilli: 0, unitPriceCents: 100 }],
        taxRateBps: 0,
      },
      code: 'INVALID_QUANTITY',
    },
    {
      name: 'a fractional milli quantity',
      input: {
        lineItems: [{ description: 'Line', quantityMilli: 1.5, unitPriceCents: 100 }],
        taxRateBps: 0,
      },
      code: 'INVALID_QUANTITY',
    },
    {
      name: 'a quantity beyond the supported integer contract',
      input: {
        lineItems: [
          {
            description: 'Line',
            quantityMilli: MAX_QUANTITY_MILLI + 1,
            unitPriceCents: 100,
          },
        ],
        taxRateBps: 0,
      },
      code: 'INVALID_QUANTITY',
    },
    {
      name: 'a negative unit price',
      input: {
        lineItems: [{ description: 'Line', quantityMilli: 1_000, unitPriceCents: -1 }],
        taxRateBps: 0,
      },
      code: 'INVALID_UNIT_PRICE',
    },
    {
      name: 'a fractional unit price',
      input: {
        lineItems: [{ description: 'Line', quantityMilli: 1_000, unitPriceCents: 1.5 }],
        taxRateBps: 0,
      },
      code: 'INVALID_UNIT_PRICE',
    },
    {
      name: 'a negative tax rate',
      input: {
        lineItems: [{ description: 'Line', quantityMilli: 1_000, unitPriceCents: 100 }],
        taxRateBps: -1,
      },
      code: 'INVALID_TAX_RATE',
    },
    {
      name: 'a fractional tax rate',
      input: {
        lineItems: [{ description: 'Line', quantityMilli: 1_000, unitPriceCents: 100 }],
        taxRateBps: 1.5,
      },
      code: 'INVALID_TAX_RATE',
    },
    {
      name: 'a tax rate over 100 percent',
      input: {
        lineItems: [{ description: 'Line', quantityMilli: 1_000, unitPriceCents: 100 }],
        taxRateBps: 10_001,
      },
      code: 'INVALID_TAX_RATE',
    },
  ])('rejects $name', ({ input, code }) => {
    expectQuoteError(() => priceQuote(input), code);
  });

  it('rejects more than the supported number of lines', () => {
    const lineItems = Array.from({ length: MAX_QUOTE_LINE_ITEMS + 1 }, (_, index) => ({
      description: `Line ${index}`,
      quantityMilli: 1_000,
      unitPriceCents: 1,
    }));

    expectQuoteError(() => priceQuote({ lineItems, taxRateBps: 0 }), 'TOO_MANY_LINE_ITEMS');
  });

  it('rejects line, subtotal, tax, and total overflow beyond MySQL INT', () => {
    expectQuoteError(
      () =>
        priceQuote({
          lineItems: [
            {
              description: 'Line overflow',
              quantityMilli: 2_000,
              unitPriceCents: MYSQL_SIGNED_INT_MAX,
            },
          ],
          taxRateBps: 0,
        }),
      'MONEY_OVERFLOW',
    );

    expectQuoteError(
      () =>
        priceQuote({
          lineItems: [
            {
              description: 'Subtotal part one',
              quantityMilli: 1_000,
              unitPriceCents: MYSQL_SIGNED_INT_MAX,
            },
            {
              description: 'Subtotal part two',
              quantityMilli: 1_000,
              unitPriceCents: 1,
            },
          ],
          taxRateBps: 0,
        }),
      'MONEY_OVERFLOW',
    );

    expectQuoteError(
      () =>
        priceQuote({
          lineItems: [
            {
              description: 'Tax or total overflow',
              quantityMilli: 1_000,
              unitPriceCents: MYSQL_SIGNED_INT_MAX,
            },
          ],
          taxRateBps: 1,
        }),
      'MONEY_OVERFLOW',
    );
  });
});

describe('quote workflow', () => {
  it('follows DRAFT -> PENDING_APPROVAL -> APPROVED -> SENT', () => {
    const pending = transitionQuote('DRAFT', 'SUBMIT_FOR_APPROVAL');
    const approved = transitionQuote(pending, 'APPROVE', owner);
    const sent = transitionQuote(approved, 'SEND', admin);

    expect(pending).toBe('PENDING_APPROVAL');
    expect(approved).toBe('APPROVED');
    expect(sent).toBe('SENT');
  });

  it.each([
    undefined,
    null,
    { kind: 'AI' as const, actorId: 'vera' },
    { kind: 'SYSTEM' as const, actorId: 'worker' },
    { kind: 'HUMAN' as const, role: 'OWNER' as const, actorId: '   ' },
  ])('rejects approve without a valid human OWNER/ADMIN actor', (actor) => {
    expectQuoteError(
      () => transitionQuote('PENDING_APPROVAL', 'APPROVE', actor),
      'HUMAN_ACTOR_REQUIRED',
    );
  });

  it.each([
    undefined,
    null,
    { kind: 'AI' as const, actorId: 'vera' },
    { kind: 'SYSTEM' as const, actorId: 'worker' },
    { kind: 'HUMAN' as const, role: 'ADMIN' as const, actorId: '' },
  ])('rejects send without a valid human OWNER/ADMIN actor', (actor) => {
    expectQuoteError(() => transitionQuote('APPROVED', 'SEND', actor), 'HUMAN_ACTOR_REQUIRED');
  });

  it('rejects invalid transitions even with an authorized human', () => {
    expectQuoteError(() => transitionQuote('DRAFT', 'APPROVE', owner), 'INVALID_TRANSITION');
    expectQuoteError(
      () => transitionQuote('PENDING_APPROVAL', 'SEND', admin),
      'INVALID_TRANSITION',
    );
    expectQuoteError(() => transitionQuote('SENT', 'APPROVE', owner), 'INVALID_TRANSITION');
  });

  it.each(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'REJECTED', 'EXPIRED'] as const)(
    'allows %s to become SUPERSEDED only through REQUOTE',
    (status) => {
      expect(transitionQuote(status, 'REQUOTE')).toBe('SUPERSEDED');
    },
  );

  it('does not allow an accepted or already superseded quote to be requoted', () => {
    expectQuoteError(() => transitionQuote('ACCEPTED', 'REQUOTE'), 'INVALID_TRANSITION');
    expectQuoteError(() => transitionQuote('SUPERSEDED', 'REQUOTE'), 'INVALID_TRANSITION');
  });

  it('never produces SUPERSEDED from another workflow action', () => {
    const transitions = [
      transitionQuote('DRAFT', 'SUBMIT_FOR_APPROVAL'),
      transitionQuote('PENDING_APPROVAL', 'APPROVE', owner),
      transitionQuote('APPROVED', 'SEND', admin),
    ];

    expect(transitions).not.toContain('SUPERSEDED');
  });
});

function expectQuoteError(operation: () => unknown, code: QuoteDomainError['code'] | string): void {
  try {
    operation();
    throw new Error('Expected operation to throw');
  } catch (error) {
    expect(error).toBeInstanceOf(QuoteDomainError);
    expect((error as QuoteDomainError).code).toBe(code);
  }
}
