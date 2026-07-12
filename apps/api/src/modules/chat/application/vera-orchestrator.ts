import type { AuditLogService } from '../../../shared/audit/audit-log.service.js';
import {
  buildVeraPrompt,
  parseAiTurn,
  VERA_PROMPT_VERSION,
  type LlmProvider,
  type KnowledgeService,
} from '../../ai/index.js';
import { LlmUnavailableError } from '../../ai/application/llm-provider.port.js';
import type { AiServiceType, AiTurn } from '../../ai/application/ai-turn.schema.js';
import { hasMeasurements, type CollectedProjectState } from './collected-project.js';
import { planConversation } from './conversation-planner.js';
import { normalizeExtraction } from './extraction-normalizer.js';
import { mergeExtraction } from './merge-policy.js';
import { quickActionFieldHints } from './quick-action.js';
import {
  isAiServiceType,
  serviceLabelEs,
  aiServiceToDb,
  aiPropertyToDb,
} from './service-mapping.js';
import { resolveTargetState } from './state-resolver.js';
import { buildSummary } from './summary.js';
import type {
  Clock,
  ChatExtractionRepository,
  ChatLeadDataRepository,
  ConversationContext,
  ConversationEngine,
  ConversationTurn,
  LeadMirror,
} from './ports.js';

const AI_UNAVAILABLE_FALLBACK =
  'Ahora mismo estoy teniendo dificultad para procesar tu mensaje, pero tu información quedó ' +
  'guardada. Puedes intentarlo nuevamente en unos momentos.';

const PARSE_FALLBACK =
  'Disculpa, no estoy segura de haber entendido bien. ¿Me lo puedes explicar de otra forma?';

const REVIEW_FAILURE_THRESHOLD = 2;

export interface VeraOrchestratorDeps {
  llm: LlmProvider;
  leadData: ChatLeadDataRepository;
  extractions: ChatExtractionRepository;
  audit: AuditLogService;
  clock: Clock;
  knowledge: KnowledgeService;
}

/**
 * The Vera conversation orchestrator (Day 3). Pipeline per turn:
 * load context → build prompt → call LLM → validate (Zod) → normalize in app
 * code → merge (policy) → persist extraction audit → resolve state (server) →
 * summarize when ready. The AI never writes the database or chooses the state.
 */
export class VeraOrchestrator implements ConversationEngine {
  constructor(private readonly deps: VeraOrchestratorDeps) {}

  async handle(ctx: ConversationContext): Promise<ConversationTurn> {
    const collected = await this.deps.leadData.loadCollected(ctx.session.leadId);
    const seeded = seedQuickAction(collected, ctx.quickActionEvent ?? null);
    const activeService = this.activeService(collected);
    const knownFields = readableFields(seeded);
    const plan = planConversation({
      collected: seeded,
      service: activeService,
      photoCount: ctx.photoCount,
      latestCustomerMessage: ctx.latestCustomerMessage,
    });
    const knowledge = this.deps.knowledge.retrieve({
      service: activeService,
      priorityTopic: plan.priorityTopic,
      knownFields,
      latestCustomerMessage: ctx.latestCustomerMessage,
    });

    const prompt = buildVeraPrompt({
      history: ctx.history
        .filter((m) => m.role !== 'SYSTEM')
        .map((m) => ({ role: m.role === 'CUSTOMER' ? 'CUSTOMER' : 'VERA', content: m.content })),
      latestCustomerMessage: ctx.latestCustomerMessage,
      knownFields,
      confirmedFields: seeded.confirmed,
      activeService,
      priorityTopic: plan.priorityTopic,
      plan,
      knowledge,
      photoCount: ctx.photoCount,
      measurementCount: hasMeasurements(seeded) ? 1 : 0,
      preferredLanguage: 'es',
      quickActionEvent: ctx.quickActionEvent ?? null,
    });

    const startedAt = Date.now();
    let content: string;
    let model = 'unknown';
    let tokensIn: number | null = null;
    let tokensOut: number | null = null;
    try {
      const result = await this.deps.llm.complete({ system: prompt.system, user: prompt.user });
      content = result.content;
      model = result.model;
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
    } catch (error) {
      const reason = error instanceof LlmUnavailableError ? error.name : 'unknown_error';
      return this.failTurn(ctx, model, Date.now() - startedAt, {
        provider: reason,
      });
    }

    let parsed = parseAiTurn(content);
    if (!parsed.ok) {
      const repair = await this.repairInvalidJson(prompt.system, content, parsed.issues);
      if (repair !== null) {
        content = repair.content;
        model = repair.model;
        tokensIn = addTokenCounts(tokensIn, repair.tokensIn);
        tokensOut = addTokenCounts(tokensOut, repair.tokensOut);
        parsed = parseAiTurn(content);
      }
    }
    if (!parsed.ok) {
      return this.failTurn(
        ctx,
        model,
        Date.now() - startedAt,
        { parse: parsed.issues },
        content,
        PARSE_FALLBACK,
        tokensIn,
        tokensOut,
      );
    }

    return this.applyValidTurn(ctx, seeded, parsed.turn, {
      model,
      latencyMs: Date.now() - startedAt,
      rawContent: content,
      tokensIn,
      tokensOut,
    });
  }

  private async applyValidTurn(
    ctx: ConversationContext,
    collected: CollectedProjectState,
    turn: AiTurn,
    meta: {
      model: string;
      latencyMs: number;
      rawContent: string;
      tokensIn: number | null;
      tokensOut: number | null;
    },
  ): Promise<ConversationTurn> {
    const normalized = normalizeExtraction(turn.extractedData, this.deps.clock.now());
    const merged = mergeExtraction(collected, normalized);

    // Detect an explicit site-visit request (intent or buying signal) and record it.
    const visitRequested =
      collected.fields['visitRequested'] === true ||
      turn.intent === 'REQUEST_VISIT' ||
      turn.buyingSignals.includes('REQUESTS_VISIT');
    if (visitRequested) {
      merged.next.fields['visitRequested'] = true;
    }

    await this.deps.leadData.saveCollected(ctx.session.leadId, merged.next);
    await this.deps.leadData.applyMirror(ctx.session.leadId, buildMirror(merged.next));

    await this.deps.extractions.save({
      sessionId: ctx.session.id,
      messageId: ctx.customerMessageId,
      model: meta.model,
      promptVersion: VERA_PROMPT_VERSION,
      rawOutput: safeJson(meta.rawContent),
      validatedOutput: turn,
      valid: true,
      errors: merged.contradictions.length > 0 ? { contradictions: merged.contradictions } : null,
      appliedFields: {
        applied: merged.applied,
        rejected: merged.rejected,
        contradictions: merged.contradictions.map((c) => c.field),
      },
      latencyMs: meta.latencyMs,
      tokensIn: meta.tokensIn,
      tokensOut: meta.tokensOut,
    });

    const photoCount = await this.deps.leadData.countPhotos(ctx.session.leadId);
    const targetState = resolveTargetState({
      currentState: ctx.session.state,
      collected: merged.next,
      photoCount,
      visitRequested,
      hasContradictions: merged.contradictions.length > 0,
    });

    const summary =
      targetState === 'READY_FOR_CONFIRMATION' ? buildSummary(merged.next, photoCount) : null;

    return {
      reply: postProcessReply(turn.replyToCustomer),
      targetState,
      summary,
      reviewFlagged: false,
    };
  }

  private async failTurn(
    ctx: ConversationContext,
    model: string,
    latencyMs: number,
    errors: unknown,
    rawContent: string | null = null,
    reply: string = AI_UNAVAILABLE_FALLBACK,
    tokensIn: number | null = null,
    tokensOut: number | null = null,
  ): Promise<ConversationTurn> {
    await this.deps.extractions.save({
      sessionId: ctx.session.id,
      messageId: ctx.customerMessageId,
      model,
      promptVersion: VERA_PROMPT_VERSION,
      rawOutput: rawContent === null ? null : safeJson(rawContent),
      validatedOutput: null,
      valid: false,
      errors,
      appliedFields: null,
      latencyMs,
      tokensIn,
      tokensOut,
    });

    const failures = await this.deps.extractions.countInvalid(ctx.session.id);
    const reviewFlagged = failures >= REVIEW_FAILURE_THRESHOLD;
    if (reviewFlagged) {
      await this.deps.audit.record({
        actorType: 'SYSTEM',
        action: 'chat.session.flagged_for_review',
        entity: 'chat_session',
        entityId: ctx.session.id,
        data: { failures },
      });
    }

    // No merge, no state advance on failure — the customer's message is preserved.
    return { reply, targetState: ctx.session.state, summary: null, reviewFlagged };
  }

  private async repairInvalidJson(
    originalSystem: string,
    invalidContent: string,
    issues: string[],
  ): Promise<{
    content: string;
    model: string;
    tokensIn: number | null;
    tokensOut: number | null;
  } | null> {
    try {
      const result = await this.deps.llm.complete({
        system: [
          originalSystem,
          '',
          'MODO REPARACIÓN JSON:',
          '- La respuesta anterior no validó contra el contrato.',
          '- Devuelve SOLO JSON válido con el mismo significado.',
          '- No añadas datos nuevos. No cambies la intención. No mejores la respuesta.',
          '- Solo corrige formato, claves faltantes, enums inválidos usando null/[] cuando sea necesario.',
        ].join('\n'),
        user: [
          `Errores de validación: ${issues.join('; ')}`,
          'Respuesta original a reparar:',
          invalidContent.slice(0, 6000),
        ].join('\n'),
      });
      return result;
    } catch {
      return null;
    }
  }

  private activeService(collected: CollectedProjectState): AiServiceType | null {
    const value = collected.fields['serviceType'];
    return typeof value === 'string' && isAiServiceType(value) ? value : null;
  }
}

function seedQuickAction(
  collected: CollectedProjectState,
  event: ConversationContext['quickActionEvent'],
): CollectedProjectState {
  if (event === null || event === undefined) return collected;
  const hints = quickActionFieldHints(event);
  const merged = mergeExtraction(collected, hints);
  return merged.next;
}

function addTokenCounts(current: number | null, add: number | null): number | null {
  if (current === null && add === null) return null;
  return (current ?? 0) + (add ?? 0);
}

function readableFields(collected: CollectedProjectState): Record<string, string> {
  const out: Record<string, string> = {};
  const f = collected.fields;
  const put = (key: string, value: unknown): void => {
    if (value !== null && value !== undefined && String(value).length > 0) {
      out[key] = Array.isArray(value) ? value.join(', ') : String(value);
    }
  };
  put('customerName', f['customerName']);
  put('phone', f['phone']);
  put('email', f['email']);
  put('municipality', f['municipality']);
  put('propertyType', f['propertyType']);
  if (typeof f['serviceType'] === 'string' && isAiServiceType(f['serviceType'])) {
    out['serviceType'] = serviceLabelEs(f['serviceType']);
  }
  put('description', f['description']);
  put('projectArea', f['projectArea']);
  if (hasMeasurements(collected)) out['measurements'] = 'registradas';
  put('requiresRemoval', f['requiresRemoval']);
  put('hasIrrigation', f['hasIrrigation']);
  put('stylePreferences', f['stylePreferences']);
  put('desiredDate', f['desiredDate']);
  if (f['visitRequested'] === true) out['visitRequested'] = 'sí';
  return out;
}

function buildMirror(collected: CollectedProjectState): LeadMirror {
  const f = collected.fields;
  const mirror: LeadMirror = { customer: {} };
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.length > 0 ? v : undefined;
  const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
  const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined);

  mirror.customer.name = str(f['customerName']);
  mirror.customer.phone = str(f['phone']);
  mirror.customer.email = str(f['email']);
  mirror.customer.municipality = str(f['municipality']);
  if (typeof f['propertyType'] === 'string') {
    mirror.customer.propertyType = aiPropertyToDb(
      f['propertyType'] as 'RESIDENTIAL' | 'COMMERCIAL' | 'HOA' | 'OTHER',
    );
  }
  if (typeof f['serviceType'] === 'string' && isAiServiceType(f['serviceType'])) {
    mirror.serviceType = aiServiceToDb(f['serviceType']);
  }
  mirror.description = str(f['description']);
  mirror.requiresRemoval = bool(f['requiresRemoval']);
  mirror.hasIrrigation = bool(f['hasIrrigation']);
  mirror.budgetMinCents = num(f['budgetMinCents']);
  mirror.budgetMaxCents = num(f['budgetMaxCents']);
  mirror.desiredDate = str(f['desiredDate']);
  mirror.preferredVisitTime = str(f['preferredVisitTime']);
  return mirror;
}

/** Strip any stray HTML and clamp length before the reply is shown/stored. */
function postProcessReply(reply: string): string {
  const clean = reply.replace(/<[^>]*>/g, '').trim();
  return clean.length > 1500 ? `${clean.slice(0, 1497)}…` : clean;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { unparsed: raw.slice(0, 4000) };
  }
}
