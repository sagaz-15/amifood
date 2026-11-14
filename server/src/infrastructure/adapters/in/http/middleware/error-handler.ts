import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../../../domain/errors/domain-error.ts';
import { RequestValidationError } from '../errors/request-validation-error.ts';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

function body(code: string, message: string, details?: unknown): ErrorBody {
  return details === undefined ? { error: { code, message } } : { error: { code, message, details } };
}

/**
 * Manejador central de errores: unico punto que traduce errores de dominio a
 * codigos HTTP. Los controladores no conocen status codes de negocio (SRP).
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof RequestValidationError) {
    res.status(400).json(body('VALIDATION_ERROR', error.message, error.details));
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json(
      body(
        'VALIDATION_ERROR',
        'Datos de entrada invalidos.',
        error.issues.map((issue) => ({
          field: issue.path.length > 0 ? issue.path.join('.') : 'request',
          message: issue.message,
        })),
      ),
    );
    return;
  }

  if (error instanceof ValidationError) {
    res.status(400).json(body(error.code, error.message, error.details));
    return;
  }

  if (error instanceof NotFoundError) {
    res.status(404).json(body(error.code, error.message));
    return;
  }

  if (error instanceof ConflictError) {
    res.status(409).json(body(error.code, error.message, error.details));
    return;
  }

  if (error instanceof ForbiddenError) {
    res.status(403).json(body(error.code, error.message));
    return;
  }

  if (error instanceof UnauthorizedError) {
    res.status(401).json(body(error.code, error.message));
    return;
  }

  if (error instanceof DomainError) {
    res.status(400).json(body(error.code, error.message));
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json(body('INVALID_JSON', 'El cuerpo de la peticion no es un JSON valido.'));
    return;
  }

  console.error(`[error] ${req.method} ${req.originalUrl}`, error);
  res.status(500).json(
    body('INTERNAL_ERROR', 'Ocurrio un error interno. Intente nuevamente o contacte al administrador.'),
  );
};
