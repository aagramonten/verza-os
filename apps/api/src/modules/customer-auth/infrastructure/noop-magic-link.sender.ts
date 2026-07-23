import type { MagicLinkSender } from '../application/ports.js';

/**
 * Delivery is intentionally deferred to the notifications phase. Tests and a
 * future provider inject a real adapter; the public endpoint never returns or
 * logs the raw login token.
 */
export class NoopMagicLinkSender implements MagicLinkSender {
  send(): Promise<void> {
    return Promise.reject(new Error('Magic-link delivery adapter is not configured'));
  }
}
