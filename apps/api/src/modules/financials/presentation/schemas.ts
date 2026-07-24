import { z } from 'zod';
import {
  CostCategory,
  MarketingChannel,
  PaymentMethod,
  PaymentType,
  ProjectStatus,
  ServiceType,
} from '@prisma/client';
import { MAX_QUANTITY_MILLI, MAX_QUOTE_LINE_ITEMS, MYSQL_SIGNED_INT_MAX } from '../domain/quote.js';

export const idSchema = z.string().uuid();

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const nonEmptyBody = <T extends z.ZodRawShape>(schema: z.ZodObject<T>) =>
  schema.partial().refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

// ── Projects ─────────────────────────────────────────────────────────

export const projectCreateSchema = z.object({
  title: z.string().max(200).optional(),
  serviceType: z.nativeEnum(ServiceType).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  scope: z.string().max(5000).optional(),
  notes: z.string().max(5000).optional(),
  contractAmountCents: z.number().int().min(0).max(2_000_000_000).nullable().optional(),
  contractSignedAt: z.coerce.date().nullable().optional(),
  wonAt: z.coerce.date().nullable().optional(),
  startedAt: z.coerce.date().nullable().optional(),
  completedAt: z.coerce.date().nullable().optional(),
  leadId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
});

export const projectUpdateSchema = nonEmptyBody(projectCreateSchema);

// ── Official quotes ─────────────────────────────────────────────────

const quoteLineItemSchema = z
  .object({
    description: z.string().trim().min(1).max(500),
    quantityMilli: z.number().int().min(1).max(MAX_QUANTITY_MILLI),
    unitPriceCents: z.number().int().min(0).max(MYSQL_SIGNED_INT_MAX),
  })
  .strict();

export const officialQuoteCreateSchema = z
  .object({
    lineItems: z.array(quoteLineItemSchema).min(1).max(MAX_QUOTE_LINE_ITEMS),
    taxRateBps: z.number().int().min(0).max(10_000),
    validUntil: z
      .string()
      .datetime({ offset: true })
      .transform((value) => new Date(value)),
    notes: z.string().max(5000).nullable().optional(),
  })
  .strict();

export const emptyActionSchema = z.object({}).strict();

// ── Costs ────────────────────────────────────────────────────────────

export const costCreateSchema = z.object({
  category: z.nativeEnum(CostCategory),
  description: z.string().min(1).max(500),
  vendor: z.string().max(200).nullable().optional(),
  quantity: z.number().nonnegative().max(1_000_000),
  unitCostCents: z.number().int().min(0).max(2_000_000_000),
  purchaseDate: z.coerce.date(),
  receiptKey: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const costUpdateSchema = nonEmptyBody(costCreateSchema);

// ── Marketing spend ──────────────────────────────────────────────────

export const marketingCreateSchema = z.object({
  channel: z.nativeEnum(MarketingChannel),
  description: z.string().max(500).nullable().optional(),
  amountCents: z.number().int().min(0).max(2_000_000_000),
  spentAt: z.coerce.date(),
  projectId: z.string().uuid().nullable().optional(),
  campaignRef: z.string().max(200).nullable().optional(),
});

export const marketingUpdateSchema = nonEmptyBody(marketingCreateSchema);

export const marketingListQuerySchema = paginationSchema.extend({
  projectId: z.string().uuid().optional(),
  channel: z.nativeEnum(MarketingChannel).optional(),
});

// ── Payments ─────────────────────────────────────────────────────────

export const paymentCreateSchema = z.object({
  amountCents: z.number().int().min(1).max(2_000_000_000),
  method: z.nativeEnum(PaymentMethod),
  type: z.nativeEnum(PaymentType),
  reference: z.string().max(200).nullable().optional(),
  receivedAt: z.coerce.date(),
  notes: z.string().max(2000).nullable().optional(),
});

export const paymentUpdateSchema = nonEmptyBody(paymentCreateSchema);
