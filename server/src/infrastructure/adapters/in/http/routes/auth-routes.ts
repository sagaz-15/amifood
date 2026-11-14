import { Router } from 'express';
import type { AuthenticationMiddleware } from '../middleware/authentication-middleware.ts';
import { validate } from '../middleware/validate.ts';
import { loginSchema } from '../schemas/auth-schemas.ts';
import type { AuthController } from '../controllers/auth-controller.ts';

export function createAuthRouter(
  controller: AuthController,
  authentication: AuthenticationMiddleware,
): Router {
  const router = Router();
  router.post('/login', validate({ body: loginSchema }), controller.login);
  router.get('/me', authentication.handle, controller.me);
  return router;
}
