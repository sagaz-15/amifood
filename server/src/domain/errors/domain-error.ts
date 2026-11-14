/**
 * Errores del dominio. No conocen HTTP ni Express: la capa de entrada
 * (middleware de errores) es la unica responsable de traducirlos a codigos HTTP.
 */
export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class ValidationError extends DomainError {
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(code, message);
    this.details = details;
  }
}

export class NotFoundError extends DomainError {}

export class ConflictError extends DomainError {
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(code, message);
    this.details = details;
  }
}

export class ForbiddenError extends DomainError {
  constructor(code: string, message: string) {
    super(code, message);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(code: string, message: string) {
    super(code, message);
  }
}
