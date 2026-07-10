import type { ChatSessionState } from '@verza/shared';

/**
 * Deterministic conversation state machine (plan §3, Day 2 scope).
 *
 * The forward path is strictly linear — the public API can never skip states,
 * and nothing in Day 2 triggers READY_FOR_CONFIRMATION → CONFIRMED: that
 * transition exists in the map but is only reachable through the explicit
 * customer confirmation action shipping on Day 8.
 */
const TRANSITIONS: Readonly<Record<ChatSessionState, readonly ChatSessionState[]>> = {
  STARTED: ['COLLECTING_CONTACT', 'ABANDONED'],
  COLLECTING_CONTACT: ['COLLECTING_PROJECT', 'ABANDONED'],
  COLLECTING_PROJECT: ['COLLECTING_MEDIA', 'ABANDONED'],
  COLLECTING_MEDIA: ['COLLECTING_MEASUREMENTS', 'ABANDONED'],
  COLLECTING_MEASUREMENTS: ['READY_FOR_CONFIRMATION', 'ABANDONED'],
  READY_FOR_CONFIRMATION: ['CONFIRMED', 'COLLECTING_PROJECT', 'ABANDONED'],
  CONFIRMED: [],
  ABANDONED: [],
};

/** States in which the customer may still send messages. */
const ACTIVE_STATES: readonly ChatSessionState[] = [
  'STARTED',
  'COLLECTING_CONTACT',
  'COLLECTING_PROJECT',
  'COLLECTING_MEDIA',
  'COLLECTING_MEASUREMENTS',
  'READY_FOR_CONFIRMATION',
];

export class InvalidStateTransitionError extends Error {
  constructor(
    public readonly from: ChatSessionState,
    public readonly to: ChatSessionState,
  ) {
    super(`Invalid chat state transition: ${from} -> ${to}`);
    this.name = 'InvalidStateTransitionError';
  }
}

export const chatStateMachine = {
  canTransition(from: ChatSessionState, to: ChatSessionState): boolean {
    return TRANSITIONS[from].includes(to);
  },

  /** Throws InvalidStateTransitionError when the move is not allowed. */
  assertTransition(from: ChatSessionState, to: ChatSessionState): void {
    if (!this.canTransition(from, to)) {
      throw new InvalidStateTransitionError(from, to);
    }
  },

  isActive(state: ChatSessionState): boolean {
    return ACTIVE_STATES.includes(state);
  },

  isTerminal(state: ChatSessionState): boolean {
    return TRANSITIONS[state].length === 0;
  },
} as const;
