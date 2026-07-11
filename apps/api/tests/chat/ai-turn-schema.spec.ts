import { describe, expect, it } from 'vitest';
import { parseAiTurn } from '../../src/modules/ai/application/ai-turn.schema.js';

function validTurn(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    replyToCustomer: 'Con gusto te ayudo.',
    language: 'es',
    intent: 'PROJECT_INQUIRY',
    extractedData: {
      customerName: null,
      phone: null,
      email: null,
      municipality: null,
      addressText: null,
      propertyType: null,
      serviceType: null,
      description: null,
      projectArea: null,
      lengthFt: null,
      widthFt: null,
      reportedSquareFeet: null,
      budgetMinCents: null,
      budgetMaxCents: null,
      requiresRemoval: null,
      hasIrrigation: null,
      desiredDate: null,
      preferredVisitTime: null,
      stylePreferences: [],
      plantPreferences: [],
      lowMaintenancePreferred: null,
      hasPets: null,
      hasChildren: null,
      sunCondition: null,
      hasDrainageConcern: null,
    },
    fieldEvidence: {},
    missingRequiredFields: [],
    missingPreferredFields: [],
    contradictions: [],
    buyingSignals: [],
    hesitationSignals: [],
    recommendedNextAction: 'CONTINUE_CONVERSATION',
    recommendedNextQuestion: null,
    readyForConfirmation: false,
    visitRecommended: false,
    safetyFlags: [],
    ...overrides,
  });
}

describe('AI turn schema', () => {
  it('accepts a valid turn', () => {
    const parsed = parseAiTurn(validTurn());
    expect(parsed.ok).toBe(true);
  });

  it('tolerates ```json fences', () => {
    const parsed = parseAiTurn('```json\n' + validTurn() + '\n```');
    expect(parsed.ok).toBe(true);
  });

  it('rejects invalid JSON', () => {
    expect(parseAiTurn('{ not json').ok).toBe(false);
  });

  it('rejects an unknown enum member (no coercion)', () => {
    expect(parseAiTurn(validTurn({ intent: 'APPROVE_QUOTE' })).ok).toBe(false);
    expect(parseAiTurn(validTurn({ recommendedNextAction: 'SEND_QUOTE' })).ok).toBe(false);
  });

  it('rejects out-of-contract numbers', () => {
    const parsed = parseAiTurn(
      validTurn({
        extractedData: JSON.parse(validTurn()).extractedData
          ? { ...JSON.parse(validTurn()).extractedData, budgetMinCents: -5 }
          : {},
      }),
    );
    expect(parsed.ok).toBe(false);
  });
});
