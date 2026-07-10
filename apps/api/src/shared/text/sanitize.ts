export const MAX_CHAT_MESSAGE_LENGTH = 2000;

export class MessageRejectedError extends Error {
  constructor(public readonly reason: 'empty' | 'too_long') {
    super(reason === 'empty' ? 'Message is empty after sanitization' : 'Message is too long');
    this.name = 'MessageRejectedError';
  }
}

/**
 * Sanitize customer-provided chat text before persistence (plan §8.8):
 * - remove all HTML tags (nothing stored may render as markup)
 * - decode nothing: content is treated as plain text end to end
 * - strip ASCII control characters except newline and tab
 * - collapse >2 consecutive blank lines, trim edges
 * - reject empty results and oversized input
 */
export function sanitizeChatMessage(raw: string): string {
  if (raw.length > MAX_CHAT_MESSAGE_LENGTH * 2) {
    // Fail fast on grossly oversized payloads before any processing.
    throw new MessageRejectedError('too_long');
  }

  // Script/style elements are removed with their contents; other tags are
  // stripped but their (potentially legitimate) text is kept.
  const withoutDangerousBlocks = raw.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
  const withoutTags = withoutDangerousBlocks.replace(/<[^>]*>/g, ' ');
  // eslint-disable-next-line no-control-regex -- stripping control chars is the point
  const withoutControl = withoutTags.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  const collapsed = withoutControl.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ');
  const trimmed = collapsed.trim();

  if (trimmed.length === 0) {
    throw new MessageRejectedError('empty');
  }
  if (trimmed.length > MAX_CHAT_MESSAGE_LENGTH) {
    throw new MessageRejectedError('too_long');
  }
  return trimmed;
}
