/**
 * Canonical merge store for a lead's conversational data (persisted in
 * lead.collectedData). `fields` holds app-validated values; `confirmed` lists
 * field names the customer has explicitly confirmed and which AI extraction
 * may never overwrite.
 */
export interface CollectedProjectState {
  fields: Record<string, unknown>;
  confirmed: string[];
}

export function emptyCollected(): CollectedProjectState {
  return { fields: {}, confirmed: [] };
}

/** Fields required before a lead may reach the confirmation summary. */
export const REQUIRED_FIELDS = [
  'customerName',
  'phone',
  'municipality',
  'serviceType',
  'description',
  'projectArea',
] as const;

/** Strongly-preferred fields (asked for, never forced). */
export const PREFERRED_FIELDS = [
  'email',
  'desiredDate',
  'budgetMaxCents',
] as const;

/** Array-valued fields are merged by union and never raise contradictions. */
export const ARRAY_FIELDS = ['stylePreferences', 'plantPreferences'] as const;

export function hasValue(state: CollectedProjectState, field: string): boolean {
  const value = state.fields[field];
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

export function hasMeasurements(state: CollectedProjectState): boolean {
  return (
    hasValue(state, 'computedSquareFeet') ||
    hasValue(state, 'reportedSquareFeet') ||
    (hasValue(state, 'lengthFt') && hasValue(state, 'widthFt'))
  );
}

export function missingRequired(state: CollectedProjectState): string[] {
  return REQUIRED_FIELDS.filter((f) => !hasValue(state, f));
}

export function missingPreferred(state: CollectedProjectState): string[] {
  return PREFERRED_FIELDS.filter((f) => !hasValue(state, f));
}
