import { Request, Response, NextFunction } from 'express';
import { logger } from './requestLogger';
import { errorResponse } from '../types/api';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class AuthError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(403, 'FORBIDDEN', message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, 'NOT_FOUND', `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
    this.name = 'ConflictError';
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorResponse(err.code, err.message, err.details));
    return;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    res.status(400).json(errorResponse('VALIDATION_ERROR', err.message));
    return;
  }

  // Invalid MongoDB ObjectId / cast failures are client input errors, not server errors.
  if (err.name === 'CastError') {
    res.status(400).json(errorResponse('VALIDATION_ERROR', 'Invalid resource identifier'));
    return;
  }

  // MongoDB duplicate key errors expose code 11000 as a number (some drivers may stringify it).
  const errorCode = (err as Error & { code?: number | string }).code;
  if (errorCode === 11000 || errorCode === '11000') {
    res.status(409).json(errorResponse('DUPLICATE_KEY', 'Resource already exists'));
    return;
  }

  // express.json() raises a SyntaxError with status 400 for malformed JSON bodies.
  const syntaxError = err as SyntaxError & { status?: number; type?: string };
  if (err instanceof SyntaxError && (syntaxError.status === 400 || syntaxError.type === 'entity.parse.failed')) {
    res.status(400).json(errorResponse('INVALID_JSON', 'Malformed JSON request body'));
    return;
  }

  logger.error('Unhandled error:', { error: err.message, stack: err.stack });
  res.status(500).json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred'));
}
