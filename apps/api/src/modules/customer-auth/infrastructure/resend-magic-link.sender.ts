import { createHash } from 'node:crypto';
import type { MagicLinkSender } from '../application/ports.js';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';

export interface ResendMagicLinkSenderConfig {
  apiKey: string;
  from: string;
  portalUrl: string;
  timeoutMs?: number;
}

/**
 * Transactional email adapter for customer portal access links.
 *
 * The raw token exists only in the provider request and the customer's link.
 * It is never returned by the public API or written to application logs.
 */
export class ResendMagicLinkSender implements MagicLinkSender {
  private readonly timeoutMs: number;

  constructor(private readonly config: ResendMagicLinkSenderConfig) {
    this.timeoutMs = config.timeoutMs ?? 10_000;
  }

  async send(input: Parameters<MagicLinkSender['send']>[0]): Promise<void> {
    if (input.channel !== 'email') {
      throw new Error('Resend magic-link delivery only supports email');
    }

    const accessUrl = new URL('/mi-jardin/verificar', this.config.portalUrl);
    accessUrl.hash = new URLSearchParams({ token: input.token }).toString();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await fetch(RESEND_EMAILS_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          'content-type': 'application/json',
          'idempotency-key': idempotencyKey(input.companyId, input.token),
          'user-agent': 'verza-os/0.1.0',
        },
        body: JSON.stringify({
          from: this.config.from,
          to: [input.destination],
          subject: 'Tu acceso a Mi Jardín | Verza Garden',
          text: [
            'Hola,',
            '',
            'Usa este enlace para entrar a Mi Jardín y ver tus proyectos:',
            accessUrl.toString(),
            '',
            'El enlace es personal, expira pronto y solo puede usarse una vez.',
            'Si no solicitaste este acceso, puedes ignorar este mensaje.',
          ].join('\n'),
          html: [
            '<p>Hola,</p>',
            '<p>Usa este enlace para entrar a <strong>Mi Jardín</strong> y ver tus proyectos:</p>',
            `<p><a href="${escapeHtml(accessUrl.toString())}">Entrar a Mi Jardín</a></p>`,
            '<p>El enlace es personal, expira pronto y solo puede usarse una vez.</p>',
            '<p>Si no solicitaste este acceso, puedes ignorar este mensaje.</p>',
          ].join(''),
        }),
      });
    } catch {
      throw new Error('Magic-link email delivery failed');
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new Error(`Magic-link email provider returned ${response.status}`);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error('Magic-link email provider returned an invalid response');
    }
    if (!isAcceptedEmail(body)) {
      throw new Error('Magic-link email provider returned an invalid response');
    }
  }
}

function idempotencyKey(companyId: string, token: string): string {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return `customer-magic-link/${companyId}/${tokenHash}`;
}

function isAcceptedEmail(value: unknown): value is { id: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)['id'] === 'string' &&
    (value as Record<string, unknown>)['id'] !== ''
  );
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
