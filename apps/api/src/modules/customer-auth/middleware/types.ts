import type { CustomerAuthContext } from '../application/ports.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      customerAuth?: CustomerAuthContext;
    }
  }
}

export {};
