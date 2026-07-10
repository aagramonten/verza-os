import type { AssistantResponder } from './ports.js';

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
 * Deterministic stand-in for the AI orchestration layer (Day 3). No
 * extraction, no scoring, no state skipping: it only ever advances the two
 * opening transitions of the approved state machine.
 */
export class PlaceholderAssistantService implements AssistantResponder {
  respond(input: {
    state: 'STARTED' | 'COLLECTING_CONTACT' | (string & {});
    customerMessageCount: number;
  }): { reply: string; nextState: 'COLLECTING_CONTACT' | 'COLLECTING_PROJECT' | null } {
    if (input.state === 'STARTED') {
      return { reply: FIRST_REPLY, nextState: 'COLLECTING_CONTACT' };
    }
    if (input.state === 'COLLECTING_CONTACT') {
      return { reply: FOLLOW_UP_REPLY, nextState: 'COLLECTING_PROJECT' };
    }
    return { reply: FOLLOW_UP_REPLY, nextState: null };
  }
}
