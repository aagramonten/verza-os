/**
 * Auth application errors. The presentation layer maps these to problem+json.
 * Credential and token failures deliberately share a generic external message
 * so the API never reveals whether an email exists or why a token failed.
 */

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

export class InvalidAccessTokenError extends Error {
  constructor(detail = 'Invalid or expired access token') {
    super(detail);
    this.name = 'InvalidAccessTokenError';
  }
}

export class InvalidRefreshTokenError extends Error {
  constructor() {
    super('Invalid or expired session');
    this.name = 'InvalidRefreshTokenError';
  }
}

/**
 * A refresh token that was already rotated (revoked) was presented again.
 * This signals theft or a client bug; the whole token family is revoked.
 */
export class RefreshTokenReuseError extends Error {
  constructor() {
    super('Session reuse detected');
    this.name = 'RefreshTokenReuseError';
  }
}
