import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResendMagicLinkSender } from '../../src/modules/customer-auth/infrastructure/resend-magic-link.sender.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('ResendMagicLinkSender', () => {
  it('sends a one-time portal link through the Resend API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'email-1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    globalThis.fetch = fetchMock;
    const sender = new ResendMagicLinkSender({
      apiKey: 're_secret',
      from: 'Verza Garden <hola@verzagarden.com>',
      portalUrl: 'https://cotizar.verzagarden.com',
    });

    await sender.send({
      companyId: 'company-1',
      customerId: 'customer-1',
      channel: 'email',
      destination: 'cliente@example.com',
      token: 'raw-secret-token',
      expiresAt: new Date('2026-07-23T12:00:00.000Z'),
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers).toMatchObject({
      authorization: 'Bearer re_secret',
      'content-type': 'application/json',
      'user-agent': 'verza-os/0.1.0',
    });
    const headers = init.headers as Record<string, string>;
    expect(headers['idempotency-key']).toMatch(/^customer-magic-link\/company-1\/[a-f0-9]{64}$/);
    const payload = JSON.parse(String(init.body)) as {
      from: string;
      to: string[];
      subject: string;
      text: string;
      html: string;
    };
    expect(payload.from).toBe('Verza Garden <hola@verzagarden.com>');
    expect(payload.to).toEqual(['cliente@example.com']);
    expect(payload.text).toContain(
      'https://cotizar.verzagarden.com/mi-jardin/verificar#token=raw-secret-token',
    );
    expect(payload.html).toContain('Entrar a Mi Jardín');
  });

  it('rejects phone delivery because WhatsApp/SMS are outside this phase', async () => {
    const sender = new ResendMagicLinkSender({
      apiKey: 're_secret',
      from: 'Verza Garden <hola@verzagarden.com>',
      portalUrl: 'https://cotizar.verzagarden.com',
    });

    await expect(
      sender.send({
        companyId: 'company-1',
        customerId: 'customer-1',
        channel: 'phone',
        destination: '+17875551234',
        token: 'raw-secret-token',
        expiresAt: new Date('2026-07-23T12:00:00.000Z'),
      }),
    ).rejects.toThrow(/only supports email/);
  });

  it('fails closed when Resend rejects the request', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
    const sender = new ResendMagicLinkSender({
      apiKey: 're_secret',
      from: 'Verza Garden <hola@verzagarden.com>',
      portalUrl: 'https://cotizar.verzagarden.com',
    });

    await expect(
      sender.send({
        companyId: 'company-1',
        customerId: 'customer-1',
        channel: 'email',
        destination: 'cliente@example.com',
        token: 'raw-secret-token',
        expiresAt: new Date('2026-07-23T12:00:00.000Z'),
      }),
    ).rejects.toThrow(/returned 403/);
  });

  it('fails closed when Resend returns an invalid success response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const sender = new ResendMagicLinkSender({
      apiKey: 're_secret',
      from: 'Verza Garden <hola@verzagarden.com>',
      portalUrl: 'https://cotizar.verzagarden.com',
    });

    await expect(
      sender.send({
        companyId: 'company-1',
        customerId: 'customer-1',
        channel: 'email',
        destination: 'cliente@example.com',
        token: 'raw-secret-token',
        expiresAt: new Date('2026-07-23T12:00:00.000Z'),
      }),
    ).rejects.toThrow(/invalid response/);
  });
});
