/**
 * LLM provider port. The orchestrator depends only on this contract; the
 * concrete adapter (OpenAI-compatible HTTP) lives in infrastructure and is
 * selected by configuration. Tests inject a mock. Providers receive ONLY the
 * system and user strings the prompt builder produced — never tokens, scores,
 * audit data, database ids, or API keys beyond their own auth.
 */
export interface LlmCompletionRequest {
  system: string;
  user: string;
}

export interface LlmCompletionResult {
  content: string;
  model: string;
  tokensIn: number | null;
  tokensOut: number | null;
}

export interface LlmProvider {
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResult>;
}

/** Provider could not be reached or returned an error status. */
export class LlmUnavailableError extends Error {
  constructor(message = 'LLM provider unavailable') {
    super(message);
    this.name = 'LlmUnavailableError';
  }
}

/** Provider did not respond within the configured deadline. */
export class LlmTimeoutError extends LlmUnavailableError {
  constructor() {
    super('LLM provider timed out');
    this.name = 'LlmTimeoutError';
  }
}
