import { existsSync, readFileSync } from 'node:fs';
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import type { AppEnv } from '../../../../config/env.ts';
import type { ProductUseCases } from '../../../../application/ports/in/product-use-cases.ts';
import type { AuthUseCases } from '../../../../application/ports/in/auth-use-cases.ts';
import type { AccountRepository } from '../../../../application/ports/out/account-repository.ts';
import type { TokenService } from '../../../../application/ports/out/token-service.ts';
import type { ProductEventBus } from '../../../../application/ports/out/product-event-bus.ts';
import { AuthenticationMiddleware } from './middleware/authentication-middleware.ts';
import { errorHandler } from './middleware/error-handler.ts';
import { ProductController } from './controllers/product-controller.ts';
import { AuthController } from './controllers/auth-controller.ts';
import { createProductRouter } from './routes/product-routes.ts';
import { createAuthRouter } from './routes/auth-routes.ts';
import { SseProductNotifier } from './sse/sse-product-notifier.ts';

export interface AppDependencies {
  env: AppEnv;
  productUseCases: ProductUseCases;
  authUseCases: AuthUseCases;
  accounts: AccountRepository;
  tokenService: TokenService;
  eventBus: ProductEventBus;
  healthCheck: () => void;
}

/**
 * Composition root del adaptador HTTP: construye Express e inyecta los casos
 * de uso ya armados. Express no aparece en dominio ni aplicacion.
 */
export function createApp(dependencies: AppDependencies): Express {
  const app = express();
  const { env } = dependencies;

  app.disable('x-powered-by');
  app.use(
    helmet({
      // Swagger UI necesita estilos/scripts inline.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors(
      env.corsOrigin === '*'
        ? {}
        : { origin: env.corsOrigin.split(',').map((origin: string) => origin.trim()) },
    ),
  );
  app.use(express.json({ limit: '100kb' }));

  const notifier = new SseProductNotifier();
  dependencies.eventBus.subscribe(notifier);

  const authentication = new AuthenticationMiddleware(dependencies.tokenService, dependencies.accounts);
  const productController = new ProductController(dependencies.productUseCases, notifier);
  const authController = new AuthController(dependencies.authUseCases);

  app.get('/api/health', (req, res) => {
    dependencies.healthCheck();
    res.status(200).json({
      status: 'ok',
      service: 'amifood-api',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/v1/products', createProductRouter(productController, authentication));
  app.use('/api/v1/auth', createAuthRouter(authController, authentication));

  // Documentacion OpenAPI / Swagger UI.
  if (existsSync(env.openApiPath)) {
    try {
      const specification = YAML.parse(readFileSync(env.openApiPath, 'utf8')) as Record<string, unknown>;
      app.get('/docs/openapi.yaml', (req, res) => {
        res.type('text/yaml').sendFile(env.openApiPath);
      });
      app.use(
        '/docs',
        swaggerUi.serve,
        swaggerUi.setup(specification, {
          customSiteTitle: 'AmiFood API - Modulo Productos',
          swaggerOptions: { persistAuthorization: true },
        }),
      );
    } catch (error) {
      console.warn('[docs] No se pudo cargar la especificacion OpenAPI:', error);
    }
  } else {
    console.warn(`[docs] No se encontro OpenAPI en ${env.openApiPath}`);
  }

  app.use(express.static(env.publicDir));

  app.use('/api', (req, res) => {
    res.status(404).json({
      error: { code: 'ENDPOINT_NOT_FOUND', message: 'El endpoint solicitado no existe.' },
    });
  });

  app.use((req, res) => {
    res.status(404).send('Recurso no encontrado');
  });

  app.use(errorHandler);

  return app;
}
