import { z } from 'zod';

/**
 * Strict contract for a single Vera turn (Day 3 spec).
 *
 * The model output is NEVER trusted until it passes this schema. Nothing
 * score-related is present: Lead Score and Customer Confidence Score stay
 * deterministic and server-side. Unknown enum members are rejected (not
 * coerced) so a hallucinated value fails validation rather than leaking
 * through.
 */

export const AI_SERVICE_TYPES = [
  'LANDSCAPE_DESIGN_INSTALLATION',
  'GARDEN_RENOVATION',
  'LAWN_INSTALLATION',
  'IRRIGATION',
  'LANDSCAPE_LIGHTING',
  'PLANTING',
  'CLEANUP_REMOVAL',
  'MAINTENANCE',
  'DECORATIVE_ROCK_MULCH',
  'OTHER',
] as const;
export type AiServiceType = (typeof AI_SERVICE_TYPES)[number];

export const AI_PROPERTY_TYPES = ['RESIDENTIAL', 'COMMERCIAL', 'HOA', 'OTHER'] as const;
export const AI_PROJECT_AREAS = [
  'FRONT_YARD',
  'BACK_YARD',
  'SIDE_YARD',
  'ENTRANCE',
  'MULTIPLE',
  'OTHER',
] as const;
export const AI_SUN_CONDITIONS = ['FULL_SUN', 'PARTIAL_SUN', 'SHADE', 'UNKNOWN'] as const;

export const AI_INTENTS = [
  'GREETING',
  'PROJECT_INQUIRY',
  'PROVIDE_INFORMATION',
  'ASK_PRICE',
  'ASK_AVAILABILITY',
  'REQUEST_VISIT',
  'UPLOAD_CONTEXT',
  'CORRECTION',
  'OBJECTION',
  'OTHER',
] as const;

export const AI_BUYING_SIGNALS = [
  'REQUESTS_VISIT',
  'HAS_BUDGET',
  'READY_SOON',
  'HAS_MEASUREMENTS',
  'HAS_PHOTOS',
  'ASKS_AVAILABILITY',
  'REFERENCES_SPECIFIC_STYLE',
  'DECISION_MAKER',
  'RETURNING_CUSTOMER',
  'REQUESTS_QUOTE',
  'HIGH_ENGAGEMENT',
] as const;

export const AI_HESITATION_SIGNALS = [
  'PRICE_ANXIETY',
  'UNCLEAR_SCOPE',
  'NO_BUDGET',
  'NO_TIMELINE',
  'NOT_DECISION_MAKER',
  'LOW_ENGAGEMENT',
  'COMPARING_PROVIDERS',
  'TRUST_CONCERN',
  'MEASUREMENT_UNCERTAINTY',
  'VISIT_HESITATION',
] as const;

export const AI_NEXT_ACTIONS = [
  'ASK_CONTACT',
  'ASK_PROJECT_TYPE',
  'ASK_MUNICIPALITY',
  'ASK_PHOTOS',
  'ASK_MEASUREMENTS',
  'ASK_BUDGET',
  'ASK_TIMELINE',
  'CLARIFY_CONTRADICTION',
  'SHOW_CONFIRMATION_SUMMARY',
  'OFFER_SITE_VISIT',
  'CONTINUE_CONVERSATION',
] as const;

const nullableString = z.string().trim().min(1).max(500).nullable();
const nullableBool = z.boolean().nullable();
// Raw numerics are bounded here; app code re-validates ranges and recomputes
// derived values (square footage) before anything is persisted.
const nullableNumber = z.number().finite().nullable();

export const extractedDataSchema = z.object({
  customerName: nullableString,
  phone: nullableString,
  email: nullableString,
  municipality: nullableString,
  addressText: z.string().trim().min(1).max(500).nullable(),
  propertyType: z.enum(AI_PROPERTY_TYPES).nullable(),
  serviceType: z.enum(AI_SERVICE_TYPES).nullable(),
  description: z.string().trim().min(1).max(2000).nullable(),
  projectArea: z.enum(AI_PROJECT_AREAS).nullable(),
  lengthFt: nullableNumber,
  widthFt: nullableNumber,
  reportedSquareFeet: nullableNumber,
  budgetMinCents: z.number().int().nonnegative().nullable(),
  budgetMaxCents: z.number().int().nonnegative().nullable(),
  requiresRemoval: nullableBool,
  hasIrrigation: nullableBool,
  desiredDate: z.string().nullable(),
  preferredVisitTime: nullableString,
  stylePreferences: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  plantPreferences: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  lowMaintenancePreferred: nullableBool,
  hasPets: nullableBool,
  hasChildren: nullableBool,
  sunCondition: z.enum(AI_SUN_CONDITIONS).nullable(),
  hasDrainageConcern: nullableBool,
});
export type ExtractedData = z.infer<typeof extractedDataSchema>;

export const fieldEvidenceSchema = z
  .record(z.object({ customerText: z.string().max(500), confidence: z.number().min(0).max(1) }))
  .default({});

export const contradictionSchema = z.object({
  field: z.string().min(1).max(60),
  existingValue: z.unknown(),
  newValue: z.unknown(),
  clarificationQuestion: z.string().min(1).max(400),
});

export const aiTurnSchema = z.object({
  replyToCustomer: z.string().trim().min(1).max(1500),
  language: z.enum(['es', 'en']),
  intent: z.enum(AI_INTENTS),
  extractedData: extractedDataSchema,
  fieldEvidence: fieldEvidenceSchema,
  missingRequiredFields: z.array(z.string().max(60)).max(40).default([]),
  missingPreferredFields: z.array(z.string().max(60)).max(40).default([]),
  contradictions: z.array(contradictionSchema).max(20).default([]),
  buyingSignals: z.array(z.enum(AI_BUYING_SIGNALS)).max(20).default([]),
  hesitationSignals: z.array(z.enum(AI_HESITATION_SIGNALS)).max(20).default([]),
  recommendedNextAction: z.enum(AI_NEXT_ACTIONS),
  recommendedNextQuestion: z.string().trim().min(1).max(400).nullable(),
  readyForConfirmation: z.boolean(),
  visitRecommended: z.boolean(),
  safetyFlags: z.array(z.string().max(80)).max(20).default([]),
});
export type AiTurn = z.infer<typeof aiTurnSchema>;

/** Parse model text (tolerating ```json fences) into a validated turn. */
export function parseAiTurn(
  rawContent: string,
): { ok: true; turn: AiTurn } | { ok: false; issues: string[] } {
  let json: unknown;
  try {
    const stripped = rawContent
      .replace(/^\s*```(?:json)?/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    json = JSON.parse(stripped);
  } catch {
    return { ok: false, issues: ['response was not valid JSON'] };
  }
  const result = aiTurnSchema.safeParse(json);
  if (!result.success) {
    return {
      ok: false,
      issues: result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    };
  }
  return { ok: true, turn: result.data };
}
