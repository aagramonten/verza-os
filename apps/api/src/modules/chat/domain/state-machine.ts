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

/**
 * The linear collecting chain. Advancing multiple phases in one turn is done
 * by walking this chain one valid step at a time — never by skipping. CONFIRMED
 * and ABANDONED are off-chain and only reachable through their explicit edges.
 */
const LINEAR_CHAIN: readonly ChatSessionState[] = [
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

  /**
   * Ordered list of intermediate states to walk forward from `from` to `to`
   * along the linear chain (each element is a single valid transition).
   * Returns [] when already at/ahead of the target, or null when `to` is not
   * forward-reachable on the chain.
   */
  forwardPath(from: ChatSessionState, to: ChatSessionState): ChatSessionState[] | null {
    const fromIndex = LINEAR_CHAIN.indexOf(from);
    const toIndex = LINEAR_CHAIN.indexOf(to);
    if (fromIndex === -1 || toIndex === -1) {
      return null;
    }
    if (toIndex <= fromIndex) {
      return [];
    }
    return LINEAR_CHAIN.slice(fromIndex + 1, toIndex + 1);
  },
} as const;
