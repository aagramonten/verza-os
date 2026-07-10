import type { NextFunction, Request, Response } from 'express';

/**
 * RFC 7807 problem+json error envelope. Stack traces and internal messages
 * never leave the process in production.
 */
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    public readonly detail?: string,
  ) {
    super(detail ?? title);
    this.name = 'HttpError';
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  const problem: Problem = {
    type: 'about:blank',
    title: 'Not Found',
    status: 404,
    detail: `No resource at ${req.method} ${req.path}`,
  };
  res.status(404).contentType('application/problem+json').json(problem);
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    const problem: Problem = {
      type: 'about:blank',
      title: err.title,
      status: err.status,
      ...(err.detail !== undefined ? { detail: err.detail } : {}),
    };
    res.status(err.status).contentType('application/problem+json').json(problem);
    return;
  }

  const problem: Problem = {
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
  };
  res.status(500).contentType('application/problem+json').json(problem);
}
