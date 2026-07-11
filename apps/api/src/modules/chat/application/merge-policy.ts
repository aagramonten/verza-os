import { ARRAY_FIELDS, hasValue, type CollectedProjectState } from './collected-project.js';

export interface FieldContradiction {
  field: string;
  existingValue: unknown;
  newValue: unknown;
}

export interface MergeResult {
  next: CollectedProjectState;
  applied: string[];
  rejected: string[];
  contradictions: FieldContradiction[];
}

/**
 * Merge app-validated extraction into the collected store (Day 3 policy):
 *
 *  - confirmed fields are never overwritten (rejected)
 *  - empty fields are filled
 *  - an equal value is a no-op
 *  - a conflicting UNCONFIRMED value is NOT applied; it becomes a contradiction
 *    the customer is asked to clarify
 *  - array fields (style/plant preferences) merge by union, never conflict
 *
 * The function is pure: it returns a new state and never mutates its input.
 */
export function mergeExtraction(
  current: CollectedProjectState,
  incoming: Record<string, unknown>,
): MergeResult {
  const next: CollectedProjectState = {
    fields: { ...current.fields },
    confirmed: [...current.confirmed],
  };
  const applied: string[] = [];
  const rejected: string[] = [];
  const contradictions: FieldContradiction[] = [];
  const confirmedSet = new Set(current.confirmed);

  for (const [field, value] of Object.entries(incoming)) {
    if (value === null || value === undefined) {
      continue;
    }

    if ((ARRAY_FIELDS as readonly string[]).includes(field)) {
      const existing = Array.isArray(current.fields[field])
        ? (current.fields[field] as string[])
        : [];
      const incomingArr = Array.isArray(value) ? (value as string[]) : [];
      const union = [...new Set([...existing, ...incomingArr])];
      if (union.length !== existing.length) {
        next.fields[field] = union;
        applied.push(field);
      }
      continue;
    }

    if (confirmedSet.has(field)) {
      rejected.push(field);
      continue;
    }

    if (!hasValue(current, field)) {
      next.fields[field] = value;
      applied.push(field);
      continue;
    }

    if (valuesEqual(current.fields[field], value)) {
      continue;
    }

    // Unconfirmed conflict: keep existing, ask for clarification.
    contradictions.push({ field, existingValue: current.fields[field], newValue: value });
    rejected.push(field);
  }

  return { next, applied, rejected, contradictions };
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (typeof a === 'string' && typeof b === 'string') {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }
  return a === b;
}

/** Mark fields confirmed (idempotent). Used by the explicit confirm action. */
export function confirmAllPresent(state: CollectedProjectState): CollectedProjectState {
  const present = Object.keys(state.fields).filter((f) => hasValue(state, f));
  return { fields: { ...state.fields }, confirmed: [...new Set([...state.confirmed, ...present])] };
}
