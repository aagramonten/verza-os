import type { AiServiceType } from './ai-turn.schema.js';
import {
  DESIGN_KNOWLEDGE,
  MATERIAL_KNOWLEDGE,
  PLANT_KNOWLEDGE,
  SERVICE_CONVERSATION_FLOWS,
  UPSELL_RULES,
  type KnowledgeBundle,
  type KnowledgeTopic,
} from './knowledge.js';

export interface KnowledgeQuery {
  service: AiServiceType | null;
  priorityTopic: string | null;
  knownFields: Record<string, string>;
  latestCustomerMessage: string;
}

export interface KnowledgeService {
  retrieve(query: KnowledgeQuery): KnowledgeBundle;
}

/**
 * In-memory implementation for the MVP. It is deliberately shaped like a
 * service so future editable tenant knowledge can replace these arrays without
 * rewriting prompts or the conversation orchestrator.
 */
export class StaticKnowledgeService implements KnowledgeService {
  retrieve(query: KnowledgeQuery): KnowledgeBundle {
    const text = [
      query.latestCustomerMessage,
      query.priorityTopic ?? '',
      Object.values(query.knownFields).join(' '),
      query.service ?? '',
    ]
      .join(' ')
      .toLowerCase();

    return {
      service: query.service === null ? null : SERVICE_CONVERSATION_FLOWS[query.service],
      designPrinciples: selectTopics(DESIGN_KNOWLEDGE, text, 6),
      plants: selectTopics(PLANT_KNOWLEDGE, text, 6),
      materials: selectTopics(MATERIAL_KNOWLEDGE, text, 6),
      upsellRules: selectTopics(UPSELL_RULES, text, 5),
      conversationTips: [
        'Pregunta directo, sin preámbulos; explica el porqué solo si el cliente lo cuestiona.',
        'Si el cliente no sabe medidas, ofrece fotos o el largo por el ancho aproximado y sigue.',
        'No bloquees la conversación por datos que se pueden confirmar en la visita.',
        'Toda recomendación debe caber en una frase y sentirse útil, no como venta forzada.',
      ],
    };
  }
}

function selectTopics(
  topics: readonly KnowledgeTopic[],
  text: string,
  fallbackCount: number,
): readonly KnowledgeTopic[] {
  const scored = topics
    .map((topic) => ({
      topic,
      score: topic.name
        .toLowerCase()
        .split(/\s+|\/|-/)
        .filter((part) => part.length > 2 && text.includes(part)).length,
    }))
    .sort((a, b) => b.score - a.score);
  const selected = scored.filter((s) => s.score > 0).map((s) => s.topic);
  return selected.length > 0 ? selected.slice(0, fallbackCount) : topics.slice(0, fallbackCount);
}
