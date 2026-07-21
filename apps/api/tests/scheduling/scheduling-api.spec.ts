import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { PrismaClient } from '@prisma/client';
import { buildApp } from '../../src/app.js';
import { createPrismaClient } from '../../src/shared/prisma.js';
import { ScryptPasswordHasher } from '../../src/modules/auth/infrastructure/scrypt-password-hasher.js';
import { testEnv } from '../helpers/test-env.js';

const env = testEnv();
const PASSWORD = 'Sched-Pw-1!';

// A future Monday 9:00 AM PR local (UTC-4) → 13:00 UTC. Keeps tests deterministic.
function prLocalMonday(hh: number, mm = 0): Date {
  // 2026-08-03 is a Monday.
  return new Date(Date.UTC(2026, 7, 3, hh + 4, mm));
}

describe('Scheduling API', () => {
  let prisma: PrismaClient;
  let app: ReturnType<typeof buildApp>;
  let tokenA = '';
  let tokenB = '';
  const companyBId = randomUUID();
  const userIds: string[] = [];
  const leadIds: string[] = [];
  const apptIds: string[] = [];
  let leadId = '';

  async function login(email: string): Promise<string> {
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
    return res.body.accessToken as string;
  }

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    prisma = createPrismaClient(env.DATABASE_URL);
    await prisma.$connect();
    app = buildApp({ env, prisma });

    await prisma.company.upsert({
      where: { slug: env.DEFAULT_COMPANY_SLUG },
      update: {},
      create: { id: env.DEFAULT_COMPANY_ID, name: 'Verza Garden', slug: env.DEFAULT_COMPANY_SLUG },
    });
    await prisma.company.create({
      data: { id: companyBId, name: 'Rival Co', slug: `rival-${companyBId}` },
    });

    const passwordHash = await new ScryptPasswordHasher().hash(PASSWORD);
    const emailA = `owner-a+${randomUUID()}@test.local`;
    const emailB = `owner-b+${randomUUID()}@test.local`;
    const a = await prisma.user.create({
      data: { companyId: env.DEFAULT_COMPANY_ID, email: emailA, name: 'A', role: 'OWNER', passwordHash },
    });
    const b = await prisma.user.create({
      data: { companyId: companyBId, email: emailB, name: 'B', role: 'ADMIN', passwordHash },
    });
    userIds.push(a.id, b.id);

    const lead = await prisma.lead.create({
      data: {
        companyId: env.DEFAULT_COMPANY_ID,
        referenceNumber: `VG-S${Math.floor(1000 + Math.random() * 8999)}`,
        serviceType: 'LAWN',
      },
    });
    leadId = lead.id;
    leadIds.push(lead.id);

    tokenA = await login(emailA);
    tokenB = await login(emailB);
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { id: { in: apptIds } } });
    await prisma.availabilityWindow.deleteMany({
      where: { companyId: { in: [env.DEFAULT_COMPANY_ID, companyBId] } },
    });
    await prisma.availabilityBlock.deleteMany({
      where: { companyId: { in: [env.DEFAULT_COMPANY_ID, companyBId] } },
    });
    await prisma.schedulingSettings.deleteMany({
      where: { companyId: { in: [env.DEFAULT_COMPANY_ID, companyBId] } },
    });
    await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.company.delete({ where: { id: companyBId } });
    await prisma.$disconnect();
  });

  it('rejects unauthenticated access with 401', async () => {
    const res = await request(app).get('/api/v1/availability');
    expect(res.status).toBe(401);
  });

  it('sets weekly availability and reads it back', async () => {
    const res = await request(app)
      .put('/api/v1/availability')
      .set(auth(tokenA))
      .send({
        windows: [{ weekday: 1, startMinute: 8 * 60, endMinute: 16 * 60 }],
        defaultVisitMinutes: 60,
        slotMinutes: 60,
      });
    expect(res.status).toBe(200);
    expect(res.body.windows).toHaveLength(1);
    expect(res.body.settings.slotMinutes).toBe(60);
  });

  it('computes free/busy slots from the working window', async () => {
    const res = await request(app)
      .get('/api/v1/availability/slots')
      .query({ from: prLocalMonday(8).toISOString(), to: prLocalMonday(12).toISOString() })
      .set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body.every((s: { free: boolean }) => s.free)).toBe(true);
  });

  it('schedules a visit for a lead with no conflicts', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .set(auth(tokenA))
      .send({ leadId, scheduledAt: prLocalMonday(9).toISOString(), durationMin: 60 });
    expect(res.status).toBe(201);
    expect(res.body.appointment.leadId).toBe(leadId);
    expect(res.body.conflicts).toEqual([]);
    apptIds.push(res.body.appointment.id);
  });

  it('warns about a conflict when a second visit overlaps but still creates it', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .set(auth(tokenA))
      .send({ leadId, scheduledAt: prLocalMonday(9, 30).toISOString(), durationMin: 60 });
    expect(res.status).toBe(201);
    expect(res.body.conflicts.length).toBeGreaterThan(0);
    expect(res.body.conflicts.map((c: { kind: string }) => c.kind)).toContain('appointment');
    apptIds.push(res.body.appointment.id);
  });

  it('warns when a visit falls outside working hours', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .set(auth(tokenA))
      .send({ leadId, scheduledAt: prLocalMonday(6).toISOString(), durationMin: 60 });
    expect(res.status).toBe(201);
    expect(res.body.conflicts.map((c: { kind: string }) => c.kind)).toContain('outside-hours');
    apptIds.push(res.body.appointment.id);
  });

  it('lists appointments in a range with lead reference', async () => {
    const res = await request(app)
      .get('/api/v1/appointments')
      .query({ from: prLocalMonday(0).toISOString(), to: prLocalMonday(23).toISOString() })
      .set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0].lead.referenceNumber).toMatch(/^VG-S/);
  });

  it('rejects scheduling against a lead from another tenant with 404', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .set(auth(tokenB))
      .send({ leadId, scheduledAt: prLocalMonday(10).toISOString() });
    expect(res.status).toBe(404);
  });

  it('rejects an invalid availability window with 400', async () => {
    const res = await request(app)
      .put('/api/v1/availability')
      .set(auth(tokenA))
      .send({ windows: [{ weekday: 9, startMinute: 100, endMinute: 50 }] });
    expect(res.status).toBe(400);
  });

  it('reschedules an appointment without conflicting with itself', async () => {
    const appointmentId = apptIds[0];
    const res = await request(app)
      .patch(`/api/v1/appointments/${appointmentId}`)
      .set(auth(tokenA))
      .send({ scheduledAt: prLocalMonday(14).toISOString() });
    expect(res.status).toBe(200);
    // Moving to an empty slot: no appointment conflict with itself.
    expect(res.body.conflicts.map((c: { kind: string }) => c.kind)).not.toContain('appointment');
  });
});
