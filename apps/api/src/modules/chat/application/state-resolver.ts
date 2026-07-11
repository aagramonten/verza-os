import type { ChatSessionState } from '@verza/shared';
import {
  hasMeasurements,
  hasValue,
  missingRequired,
  type CollectedProjectState,
} from './collected-project.js';

export interface ResolveInput {
  currentState: ChatSessionState;
  collected: CollectedProjectState;
  photoCount: number;
  visitRequested: boolean;
  hasContradictions: boolean;
}

/**
 * Server-authoritative target phase for a turn. The AI never chooses the
 * state; this pure function does, from persisted validated data. The caller
 * walks the state machine forward to this target (never skipping, never
 * regressing except the explicit correction edge). CONFIRMED is intentionally
 * unreachable here — only the explicit customer confirmation action sets it.
 */
export function resolveTargetState(input: ResolveInput): ChatSessionState {
  const { currentState, collected } = input;

  // Contradictions pause forward progress: stay put and let Vera clarify.
  if (input.hasContradictions) {
    return currentState;
  }

  const hasContact =
    hasValue(collected, 'customerName') ||
    hasValue(collected, 'phone') ||
    hasValue(collected, 'municipality') ||
    hasValue(collected, 'propertyType');
  const hasService = hasValue(collected, 'serviceType');
  const requiredComplete = missingRequired(collected).length === 0;
  const oneOfContext = input.photoCount > 0 || hasMeasurements(collected) || input.visitRequested;

  let target: ChatSessionState = 'STARTED';
  if (requiredComplete && oneOfContext) {
    target = 'READY_FOR_CONFIRMATION';
  } else if (requiredComplete) {
    // Everything but a photo/measurement/visit — gather that next.
    target = 'COLLECTING_MEASUREMENTS';
  } else if (hasService) {
    target = 'COLLECTING_PROJECT';
  } else if (hasContact) {
    target = 'COLLECTING_CONTACT';
  } else {
    // Nothing actionable yet: take the first forward step off STARTED.
    target = currentState === 'STARTED' ? 'COLLECTING_CONTACT' : currentState;
  }

  return target;
}
