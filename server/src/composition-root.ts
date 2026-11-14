import type { Express } from 'express';
import type { SqliteDatabase } from './infrastructure/adapters/out/persistence/sqlite/database.ts';
import { openDatabase, runMigrations } from './infrastructure/adapters/out/persistence/sqlite/database.ts';
import { seedDatabase } from './infrastructure/adapters/out/persistence/sqlite/seed.ts';
import { SqliteProductRepository } from './infrastructure/adapters/out/persistence/sqlite/sqlite-product-repository.ts';
import { SqliteAccountRepository } from './infrastructure/adapters/out/persistence/sqlite/sqlite-account-repository.ts';
import { SqliteStoreRepository } from './infrastructure/adapters/out/persistence/sqlite/sqlite-store-repository.ts';
import { BcryptPasswordHasher } from './infrastructure/adapters/out/security/bcrypt-password-hasher.ts';
import { JwtTokenService } from './infrastructure/adapters/out/security/jwt-token-service.ts';
import { InMemoryEventBus } from './infrastructure/adapters/out/events/in-memory-event-bus.ts';
import { AuditLogSubscriber } from './infrastructure/adapters/out/events/audit-log-subscriber.ts';
import { ProductFactory } from './domain/factories/product-factory.ts';
import { ProductService } from './application/services/product-service.ts';
import { AuthService } from './application/services/auth-service.ts';
import { createApp } from './infrastructure/adapters/in/http/app.ts';
import { env } from './config/env.ts';

export interface Application {
  app: Express;
  db: SqliteDatabase;
}

function countAccounts(db: SqliteDatabase): number {
  const row = db.prepare('SELECT COUNT(*) AS total FROM accounts').get() as
    | { total: number | bigint }
    | undefined;
  return Number(row?.total ?? 0);
}

/**
 * COMPOSITION ROOT: unico lugar donde se instancian adaptadores concretos y se
 * inyectan en los casos de uso. Cambiar SQLite por otro motor solo afecta a
 * este archivo y al nuevo adaptador (DIP).
 */
export async function buildApplication(): Promise<Application> {
  const db = openDatabase(env.dbFile);
  runMigrations(db);

  const passwordHasher = new BcryptPasswordHasher(10);
  if (env.seedOnStart && countAccounts(db) === 0) {
    await seedDatabase(db, { csvPath: env.csvPath, passwordHasher });
  }

  const productFactory = new ProductFactory();
  const products = new SqliteProductRepository(db, productFactory);
  const accounts = new SqliteAccountRepository(db);
  const stores = new SqliteStoreRepository(db);

  const eventBus = new InMemoryEventBus();
  eventBus.subscribe(new AuditLogSubscriber());

  const tokenService = new JwtTokenService(env.jwtSecret, env.jwtExpiresIn);

  const productService = new ProductService({
    products,
    stores,
    events: eventBus,
    factory: productFactory,
  });

  const authService = new AuthService({
    accounts,
    stores,
    passwordHasher,
    tokenService,
    expiresIn: env.jwtExpiresIn,
  });

  const app = createApp({
    env,
    productUseCases: productService,
    authUseCases: authService,
    accounts,
    tokenService,
    eventBus,
    healthCheck: () => {
      db.prepare('SELECT 1 AS ok').get();
    },
  });

  return { app, db };
}
