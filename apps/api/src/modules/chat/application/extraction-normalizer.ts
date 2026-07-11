import type { ExtractedData } from '../../ai/application/ai-turn.schema.js';
import { normalizePhone } from '../../../shared/phone/normalize.js';
import {
  clampBudgetCents,
  computeSquareFeet,
  sanitizeDimension,
  sanitizeReportedSqFt,
  validateDesiredDate,
  validateEmail,
} from './field-validation.js';

/**
 * Turns raw (schema-valid) AI extraction into app-validated field values.
 * Every derived/normalized value is produced here in application code:
 * phone → E.164, email validated, dimensions bounded, square footage
 * computed (never trusted from the model), date validated, money clamped.
 * Fields that fail validation are simply dropped (left absent), never stored raw.
 */
export function normalizeExtraction(data: ExtractedData, now: Date): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const set = (key: string, value: unknown): void => {
    if (value !== null && value !== undefined) {
      out[key] = value;
    }
  };

  set('customerName', trimOrNull(data.customerName));
  set('phone', data.phone !== null ? (normalizePhone(data.phone)?.e164 ?? null) : null);
  set('email', validateEmail(data.email));
  set('municipality', trimOrNull(data.municipality));
  set('addressText', trimOrNull(data.addressText));
  set('propertyType', data.propertyType);
  set('serviceType', data.serviceType);
  set('description', trimOrNull(data.description));
  set('projectArea', data.projectArea);

  const lengthFt = sanitizeDimension(data.lengthFt);
  const widthFt = sanitizeDimension(data.widthFt);
  set('lengthFt', lengthFt);
  set('widthFt', widthFt);
  set('computedSquareFeet', computeSquareFeet(lengthFt, widthFt));
  set('reportedSquareFeet', sanitizeReportedSqFt(data.reportedSquareFeet));

  const budgetMin = clampBudgetCents(data.budgetMinCents);
  const budgetMax = clampBudgetCents(data.budgetMaxCents);
  // Discard an inverted range rather than store nonsense.
  if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) {
    // keep neither
  } else {
    set('budgetMinCents', budgetMin);
    set('budgetMaxCents', budgetMax);
  }

  set('requiresRemoval', data.requiresRemoval);
  set('hasIrrigation', data.hasIrrigation);
  set('desiredDate', validateDesiredDate(data.desiredDate, now));
  set('preferredVisitTime', trimOrNull(data.preferredVisitTime));
  set('lowMaintenancePreferred', data.lowMaintenancePreferred);
  set('hasPets', data.hasPets);
  set('hasChildren', data.hasChildren);
  set('sunCondition', data.sunCondition);
  set('hasDrainageConcern', data.hasDrainageConcern);

  if (data.stylePreferences.length > 0) set('stylePreferences', dedupe(data.stylePreferences));
  if (data.plantPreferences.length > 0) set('plantPreferences', dedupe(data.plantPreferences));

  return out;
}

function trimOrNull(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter((v) => v.length > 0))];
}
