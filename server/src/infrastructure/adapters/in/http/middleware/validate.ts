import type { RequestHandler } from 'express';
import { ZodError, type ZodType } from 'zod';
import { RequestValidationError } from '../errors/request-validation-error.ts';

export interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Middleware de validacion reutilizable (DRY): valida body/query/params con
 * Zod y deja los datos ya normalizados en res.locals.validated.
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, res, next) => {
    try {
      const validated = {
        body: schemas.body ? schemas.body.parse(req.body) : undefined,
        query: schemas.query ? schemas.query.parse(req.query) : undefined,
        params: schemas.params ? schemas.params.parse(req.params) : undefined,
      };
      res.locals.validated = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new RequestValidationError(
            error.issues.map((issue) => ({
              field: issue.path.length > 0 ? issue.path.join('.') : 'request',
              message: issue.message,
            })),
          ),
        );
        return;
      }
      next(error);
    }
  };
}
