/**
 * @verza/shared — domain vocabulary shared by API and web.
 *
 * Single source of truth for the closed enums used across the Vera chat MVP
 * (docs/vera-chat-mvp-plan.md §2/§7, docs/vera-conversation-strategy.md §4–6)
 * and for the versioned scoring configuration consumed by the deterministic
 * scoring engines (built Day 5; the config ships Day 1 so it is seeded and
 * versioned from the start).
 */

export const SERVICE_TYPES = [
  'DESIGN_INSTALLATION',
  'LAWN',
  'IRRIGATION',
  'LIGHTING',
  'PLANTING',
  'CLEANUP',
  'MAINTENANCE',
  'OTHER',
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const LEAD_STATUSES = [
  'DRAFT',
  'COLLECTING',
  'PENDING_CONFIRMATION',
  'READY_FOR_REVIEW',
  'ARCHIVED',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const CHAT_SESSION_STATES = [
  'STARTED',
  'COLLECTING_CONTACT',
  'COLLECTING_PROJECT',
  'COLLECTING_MEDIA',
  'COLLECTING_MEASUREMENTS',
  'READY_FOR_CONFIRMATION',
  'CONFIRMED',
  'ABANDONED',
] as const;
export type ChatSessionState = (typeof CHAT_SESSION_STATES)[number];

export const BUYING_SIGNALS = [
  'urgent_timeline',
  'has_inspiration_photos',
  'has_budget',
  'budget_flexible',
  'asks_availability',
  'already_measured',
  'decision_maker',
  'repeat_intent',
  'asks_process',
  'positive_engagement',
  'requests_visit',
] as const;
export type BuyingSignal = (typeof BUYING_SIGNALS)[number];

export const HESITATION_SIGNALS = [
  'price_anxiety',
  'uncertainty',
  'comparison_shopping',
  'low_engagement',
  'distrust',
  'not_decision_maker',
  'vague_timeline',
  'overwhelmed',
  'corrects_repeatedly',
  'abandon_risk',
] as const;
export type HesitationSignal = (typeof HESITATION_SIGNALS)[number];

export const NEXT_ACTIONS = [
  'SCHEDULE_SITE_VISIT',
  'TRUST_FIRST_FOLLOWUP',
  'SEND_PRELIMINARY_ESTIMATE',
  'REQUEST_MORE_PHOTOS',
  'LOW_PRIORITY_FOLLOWUP',
] as const;
export type NextAction = (typeof NEXT_ACTIONS)[number];

export const CONVERSION_BANDS = ['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'VERY_LOW'] as const;
export type ConversionBand = (typeof CONVERSION_BANDS)[number];

/**
 * Versioned weights for the two deterministic scoring engines
 * (strategy §6a Lead Score, §6b Customer Confidence Score).
 * Stored in the scoring_configs table; the engines (Day 5) read the active
 * version — never hardcode weights in engine code.
 */
export interface ScoringConfig {
  version: number;
  leadScore: {
    timelineUrgency: {
      max: number;
      urgentTimeline: number;
      concreteDate: number;
      vagueTimeline: number;
    };
    budgetConfidence: {
      max: number;
      statedInRange: number;
      budgetFlexible: number;
      priceAnxiety: number;
      belowMinimumJob: number;
    };
    projectReadiness: {
      max: number;
      requestsVisit: number;
      alreadyMeasured: number;
      decisionMaker: number;
      notDecisionMaker: number;
    };
    informationCompleteness: { max: number };
    photos: { max: number; onePhoto: number; threePhotos: number; inspirationPhotos: number };
    engagement: {
      max: number;
      sixMessages: number;
      replyLengthBand: number;
      positiveEngagement: number;
      lowEngagement: number;
    };
    serviceValue: { max: number; tiers: Record<ServiceType, number> };
  };
  confidenceScore: {
    baseline: number;
    decisiveness: {
      min: number;
      max: number;
      directAnswer: number;
      unresolvedUnknown: number;
      resolvedByReassurance: number;
    };
    trust: { min: number; max: number; positiveAcknowledgment: number; distrust: number };
    anxiety: {
      min: number;
      max: number;
      priceAnxiety: number;
      overwhelmed: number;
      calmedAfterReassurance: number;
    };
    clarityOfVision: { min: number; max: number; describesOutcome: number; uncertainty: number };
    commitment: {
      min: number;
      max: number;
      uploadsPhotos: number;
      entersMeasurements: number;
      confirmsSummary: number;
      abandonRisk: number;
    };
    flowHealth: {
      min: number;
      max: number;
      steadyReplies: number;
      lowEngagement: number;
      correctsRepeatedly: number;
    };
  };
  bands: { veryHigh: number; high: number; medium: number; low: number };
}

/** Scoring config v1 — weights exactly as approved in strategy §6. */
export const SCORING_CONFIG_V1: ScoringConfig = {
  version: 1,
  leadScore: {
    timelineUrgency: { max: 20, urgentTimeline: 14, concreteDate: 6, vagueTimeline: -8 },
    budgetConfidence: {
      max: 20,
      statedInRange: 14,
      budgetFlexible: 6,
      priceAnxiety: -6,
      belowMinimumJob: -10,
    },
    projectReadiness: {
      max: 20,
      requestsVisit: 10,
      alreadyMeasured: 6,
      decisionMaker: 4,
      notDecisionMaker: -6,
    },
    informationCompleteness: { max: 15 },
    photos: { max: 10, onePhoto: 6, threePhotos: 10, inspirationPhotos: 2 },
    engagement: {
      max: 10,
      sixMessages: 4,
      replyLengthBand: 3,
      positiveEngagement: 3,
      lowEngagement: -5,
    },
    serviceValue: {
      max: 5,
      tiers: {
        DESIGN_INSTALLATION: 5,
        IRRIGATION: 5,
        LAWN: 3,
        LIGHTING: 3,
        PLANTING: 3,
        CLEANUP: 2,
        MAINTENANCE: 2,
        OTHER: 2,
      },
    },
  },
  confidenceScore: {
    baseline: 50,
    decisiveness: {
      min: -15,
      max: 15,
      directAnswer: 2,
      unresolvedUnknown: -3,
      resolvedByReassurance: 2,
    },
    trust: { min: -15, max: 15, positiveAcknowledgment: 3, distrust: -8 },
    anxiety: { min: -15, max: 15, priceAnxiety: -6, overwhelmed: -6, calmedAfterReassurance: 4 },
    clarityOfVision: { min: -10, max: 10, describesOutcome: 6, uncertainty: -4 },
    commitment: {
      min: -15,
      max: 15,
      uploadsPhotos: 5,
      entersMeasurements: 5,
      confirmsSummary: 5,
      abandonRisk: -10,
    },
    flowHealth: { min: -10, max: 10, steadyReplies: 4, lowEngagement: -4, correctsRepeatedly: -4 },
  },
  bands: { veryHigh: 80, high: 60, medium: 40, low: 20 },
};

/** Lead reference numbers look like VG-0042. */
export const LEAD_REFERENCE_PREFIX = 'VG';

/** Official preliminary-estimate disclaimer — must accompany every price mention. */
export const ESTIMATE_DISCLAIMER_ES =
  'Este es un estimado preliminar basado en la información suministrada. La cotización oficial ' +
  'será preparada y aprobada por Verza Garden luego de revisar las fotos, medidas y condiciones del área.';
