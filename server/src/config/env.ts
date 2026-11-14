import path from 'node:path';
import { z } from 'zod';

export const SERVER_ROOT = path.resolve(import.meta.dirname, '..', '..');
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');

const DEFAULT_JWT_SECRET = 'amifood-dev-only-secret-change-me';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65_535).default(3000),
  JWT_SECRET: z.string().min(16).default(DEFAULT_JWT_SECRET),
  JWT_EXPIRES_IN: z.string().default('24h'),
  DB_FILE: z.string().default('./data/amifood.db'),
  CORS_ORIGIN: z.string().default('*'),
  SEED_ON_START: z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),
  OPENAPI_PATH: z.string().default('../docs/openapi.yaml'),
});

const parsed = EnvSchema.parse(process.env);

if (parsed.NODE_ENV === 'production' && parsed.JWT_SECRET === DEFAULT_JWT_SECRET) {
  throw new Error('JWT_SECRET es obligatorio en produccion (no use el valor por defecto).');
}

function resolveFromServer(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(SERVER_ROOT, value);
}

export const env = {
  nodeEnv: parsed.NODE_ENV,
  port: parsed.PORT,
  jwtSecret: parsed.JWT_SECRET,
  jwtExpiresIn: parsed.JWT_EXPIRES_IN,
  dbFile: resolveFromServer(parsed.DB_FILE),
  corsOrigin: parsed.CORS_ORIGIN,
  seedOnStart: parsed.SEED_ON_START,
  openApiPath: resolveFromServer(parsed.OPENAPI_PATH),
  publicDir: path.join(PROJECT_ROOT, 'public'),
  csvPath: path.join(PROJECT_ROOT, 'data', 'productos.csv'),
} as const;

export type AppEnv = typeof env;
