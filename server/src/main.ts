import { buildApplication } from './composition-root.ts';
import { env } from './config/env.ts';

const { app, db } = await buildApplication();

const server = app.listen(env.port, () => {
  console.log(`AmiFood API escuchando en http://localhost:${env.port}`);
  console.log(`Swagger UI:      http://localhost:${env.port}/docs`);
  console.log(`OpenAPI:         http://localhost:${env.port}/docs/openapi.yaml`);
  console.log(`Health:          http://localhost:${env.port}/api/health`);
  console.log(`Productos:       http://localhost:${env.port}/api/v1/products`);
});

function shutdown(signal: string): void {
  console.log(`\n${signal} recibido. Cerrando servidor...`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
