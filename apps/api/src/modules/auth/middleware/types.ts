import type { AuthContext } from '../application/ports.js';

// Augment Express' Request with the verified auth context. Populated only by
// the `authenticate` middleware; downstream handlers can rely on its presence
// after that guard runs.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export {};
