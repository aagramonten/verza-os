/** Domain errors for the chat module. Presentation maps these to problem+json. */

export class ChatSessionNotFoundError extends Error {
  constructor(public readonly sessionId: string) {
    super('Chat session not found');
    this.name = 'ChatSessionNotFoundError';
  }
}

/**
 * Raised for every resume-token failure mode (missing, malformed, mismatched,
 * expired, revoked). One error type on purpose: the public API must not act
 * as an oracle distinguishing "wrong token" from "expired token".
 */
export class InvalidResumeTokenError extends Error {
  constructor(public readonly reason: 'invalid' | 'expired' | 'revoked') {
    super('Resume token is not valid for this session');
    this.name = 'InvalidResumeTokenError';
  }
}

export class SessionClosedError extends Error {
  constructor(public readonly sessionId: string) {
    super('This chat session no longer accepts messages');
    this.name = 'SessionClosedError';
  }
}

/** Raised when confirm/correct is called but the session is not awaiting confirmation. */
export class ConfirmationNotAvailableError extends Error {
  constructor(public readonly sessionId: string) {
    super('This session is not ready for confirmation');
    this.name = 'ConfirmationNotAvailableError';
  }
}
