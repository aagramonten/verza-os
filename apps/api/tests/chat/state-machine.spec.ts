import { describe, expect, it } from 'vitest';
import { CHAT_SESSION_STATES, type ChatSessionState } from '@verza/shared';
import {
  chatStateMachine,
  InvalidStateTransitionError,
} from '../../src/modules/chat/domain/state-machine.js';

describe('chat state machine', () => {
  it.each([
    ['STARTED', 'COLLECTING_CONTACT'],
    ['COLLECTING_CONTACT', 'COLLECTING_PROJECT'],
    ['COLLECTING_PROJECT', 'COLLECTING_MEDIA'],
    ['COLLECTING_MEDIA', 'COLLECTING_MEASUREMENTS'],
    ['COLLECTING_MEASUREMENTS', 'READY_FOR_CONFIRMATION'],
    ['READY_FOR_CONFIRMATION', 'CONFIRMED'],
    ['READY_FOR_CONFIRMATION', 'COLLECTING_PROJECT'], // correction loop
    ['STARTED', 'ABANDONED'],
    ['COLLECTING_PROJECT', 'ABANDONED'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(chatStateMachine.canTransition(from, to)).toBe(true);
    expect(() => chatStateMachine.assertTransition(from, to)).not.toThrow();
  });

  it.each([
    ['STARTED', 'COLLECTING_PROJECT'], // skipping a state
    ['STARTED', 'READY_FOR_CONFIRMATION'],
    ['STARTED', 'CONFIRMED'],
    ['COLLECTING_CONTACT', 'READY_FOR_CONFIRMATION'],
    ['COLLECTING_CONTACT', 'CONFIRMED'],
    ['COLLECTING_PROJECT', 'CONFIRMED'],
    ['CONFIRMED', 'STARTED'], // terminal states go nowhere
    ['ABANDONED', 'STARTED'],
    ['COLLECTING_MEDIA', 'COLLECTING_CONTACT'], // no going backwards
  ] as const)('rejects %s -> %s', (from, to) => {
    expect(chatStateMachine.canTransition(from, to)).toBe(false);
    expect(() => chatStateMachine.assertTransition(from, to)).toThrow(InvalidStateTransitionError);
  });

  it('CONFIRMED is only reachable from READY_FOR_CONFIRMATION', () => {
    const sources = CHAT_SESSION_STATES.filter((from: ChatSessionState) =>
      chatStateMachine.canTransition(from, 'CONFIRMED'),
    );
    expect(sources).toEqual(['READY_FOR_CONFIRMATION']);
  });

  it('marks terminal states', () => {
    expect(chatStateMachine.isTerminal('CONFIRMED')).toBe(true);
    expect(chatStateMachine.isTerminal('ABANDONED')).toBe(true);
    expect(chatStateMachine.isTerminal('STARTED')).toBe(false);
    expect(chatStateMachine.isActive('CONFIRMED')).toBe(false);
    expect(chatStateMachine.isActive('COLLECTING_PROJECT')).toBe(true);
  });
});
