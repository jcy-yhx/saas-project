import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { getLogger } from '../config/index.js';

const logger = getLogger();

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Prisma known errors
  if (err.constructor?.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as { code?: string; meta?: unknown };
    if (prismaErr.code === 'P2002') {
      res.status(409).json({
        error: {
          code: 'CONFLICT',
          message: 'A record with that value already exists',
          details: prismaErr.meta,
        },
      });
      return;
    }
  }

  // Unexpected error
  logger.error(err, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
