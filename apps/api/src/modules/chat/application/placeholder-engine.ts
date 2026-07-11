import type { ConversationContext, ConversationEngine, ConversationTurn } from './ports.js';

const FIRST_REPLY =
  'Hola 👋\n\n' +
  'Soy Vera, la asistente virtual de Verza Garden.\n\n' +
  'Con mucho gusto te ayudaré a recopilar la información de tu proyecto.\n\n' +
  'Para comenzar, ¿me puedes indicar tu nombre y el pueblo donde se encuentra el proyecto?';

const FOLLOW_UP_REPLY =
  'Perfecto.\n\n' +
  'Estoy recopilando la información necesaria.\n\n' +
  'En el próximo paso podré hacerte preguntas más específicas para entender mejor tu proyecto.';

/**
 * Deterministic engine used when AI is disabled (`AI_ENABLED=false`). Keeps
 * the app fully runnable without credentials and reproduces the Day 2
 * behavior: greet, then acknowledge, advancing only the first two phases. No
 * extraction, no scoring, no state skipping.
 */
export class PlaceholderConversationEngine implements ConversationEngine {
  handle(ctx: ConversationContext): Promise<ConversationTurn> {
    if (ctx.session.state === 'STARTED') {
      return Promise.resolve(turn(FIRST_REPLY, 'COLLECTING_CONTACT'));
    }
    if (ctx.session.state === 'COLLECTING_CONTACT') {
      return Promise.resolve(turn(FOLLOW_UP_REPLY, 'COLLECTING_PROJECT'));
    }
    return Promise.resolve(turn(FOLLOW_UP_REPLY, ctx.session.state));
  }
}

function turn(reply: string, targetState: ConversationTurn['targetState']): ConversationTurn {
  return { reply, targetState, summary: null, reviewFlagged: false };
}
