import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { requireRole } from '../../src/modules/auth/middleware/require-role.js';
import { HttpError } from '../../src/shared/http/problem.js';
import type { AuthContext } from '../../src/modules/auth/application/ports.js';

function reqWith(auth?: AuthContext): Request {
  return { auth } as unknown as Request;
}
const res = {} as Response;

describe('requireRole', () => {
  it('allows a caller whose role is in the allow-list', () => {
    const next = vi.fn();
    const auth: AuthContext = { userId: 'u', companyId: 'c', role: 'OWNER' };
    requireRole('OWNER', 'ADMIN')(reqWith(auth), res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a caller whose role is not allowed with 403', () => {
    const next = vi.fn();
    const auth: AuthContext = { userId: 'u', companyId: 'c', role: 'ADMIN' };
    requireRole('OWNER')(reqWith(auth), res, next);
    const err = next.mock.calls[0]![0] as HttpError;
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(403);
  });

  it('rejects an unauthenticated request with 401', () => {
    const next = vi.fn();
    requireRole('OWNER')(reqWith(undefined), res, next);
    const err = next.mock.calls[0]![0] as HttpError;
    expect(err).toBeInstanceOf(HttpError);
    expect(err.status).toBe(401);
  });
});
