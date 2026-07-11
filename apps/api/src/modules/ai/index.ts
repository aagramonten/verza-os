import type { Env } from '../../config/env.js';
import type { LlmProvider } from './application/llm-provider.port.js';
import { OpenAiCompatibleProvider } from './infrastructure/openai-compatible.provider.js';

/**
 * Builds the configured LLM provider, or null when AI is disabled. A null
 * provider means the chat module wires the deterministic placeholder engine
 * instead — the app runs fully without any AI credentials.
 */
export function createLlmProvider(env: Env): LlmProvider | null {
  if (!env.AI_ENABLED) {
    return null;
  }
  return new OpenAiCompatibleProvider({
    baseUrl: env.AI_PROVIDER_BASE_URL,
    apiKey: env.AI_PROVIDER_API_KEY,
    model: env.AI_MODEL,
  });
}

export type { LlmProvider } from './application/llm-provider.port.js';
export { LlmUnavailableError, LlmTimeoutError } from './application/llm-provider.port.js';
export { buildVeraPrompt, VERA_PROMPT_VERSION } from './application/prompt-builder.js';
export { parseAiTurn, type AiTurn } from './application/ai-turn.schema.js';
