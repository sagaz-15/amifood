export interface ValidationIssue {
  field: string;
  message: string;
}

/** Error de validacion de entrada; el manejador central lo traduce a HTTP 400. */
export class RequestValidationError extends Error {
  readonly details: ValidationIssue[];

  constructor(details: ValidationIssue[]) {
    super('Datos de entrada invalidos.');
    this.name = 'RequestValidationError';
    this.details = details;
  }
}
