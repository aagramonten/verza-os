import {
  LlmTimeoutError,
  LlmUnavailableError,
  type LlmCompletionRequest,
  type LlmCompletionResult,
  type LlmProvider,
} from '../application/llm-provider.port.js';

export interface OpenAiCompatibleConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs?: number;
  temperature?: number;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * Adapter for any OpenAI-compatible `/chat/completions` endpoint (OpenAI,
 * Groq, local gateways, etc.). Requests JSON output, enforces a hard timeout,
 * and translates transport/HTTP failures into the port's error types so the
 * orchestrator can fall back gracefully.
 */
export class OpenAiCompatibleProvider implements LlmProvider {
  private readonly timeoutMs: number;
  private readonly temperature: number;

  constructor(private readonly config: OpenAiCompatibleConfig) {
    this.timeoutMs = config.timeoutMs ?? 20_000;
    this.temperature = config.temperature ?? 0.4;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: this.temperature,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
        }),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new LlmTimeoutError();
      }
      throw new LlmUnavailableError('LLM request failed');
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new LlmUnavailableError(`LLM provider returned ${response.status}`);
    }

    const body = (await response.json()) as ChatCompletionResponse;
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.length === 0) {
      throw new LlmUnavailableError('LLM provider returned an empty response');
    }

    return {
      content,
      model: this.config.model,
      tokensIn: body.usage?.prompt_tokens ?? null,
      tokensOut: body.usage?.completion_tokens ?? null,
    };
  }
}
