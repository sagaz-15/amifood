import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import type { DatabaseSync } from 'node:sqlite';
import type { PasswordHasher } from '../../../../../application/ports/out/password-hasher.ts';
import type { AccountRole } from '../../../../../domain/entities/account.ts';
import type { ProductCategory } from '../../../../../domain/entities/product.ts';

export interface SeedOptions {
  csvPath: string;
  reset?: boolean;
  passwordHasher: PasswordHasher;
  log?: (message: string) => void;
}

export interface SeedResult {
  seeded: boolean;
  stores: number;
  accounts: number;
  products: number;
}

const DEFAULT_PASSWORD = 'AmiFood123*';
const ADMIN_PASSWORD = 'Admin123*';

interface SeedStore {
  key: string;
  name: string;
  email: string;
  location: string;
  description: string;
  imageUrl: string;
  accountEmail: string;
}

const STORES: SeedStore[] = [
  {
    key: 'la frutera',
    name: 'La Frutera',
    email: 'lafrutera@amifood.com',
    accountEmail: 'lafrutera@amifood.com',
    location: 'Bloque 5, al lado del bloque 3',
    description: 'Frutas, arepas y comidas rapidas.',
    imageUrl: '/img/frutera.jpeg',
  },
  {
    key: 'deli u',
    name: 'Deli U',
    email: 'deliu@amifood.com',
    accountEmail: 'deliu@amifood.com',
    location: 'Bloque 1',
    description: 'Pasteles, empanadas y pizzas.',
    imageUrl: '/img/deli u.jpg',
  },
  {
    key: 'cafe los frailes',
    name: 'Cafe los Frailes',
    email: 'frailes@amifood.com',
    accountEmail: 'frailes@amifood.com',
    location: 'Atras del bloque 1',
    description: 'Cafeteria y sandwiches.',
    imageUrl: '/img/frailes.jpg',
  },
  {
    key: 'al toque',
    name: 'Al Toque',
    email: 'altoque@amifood.com',
    accountEmail: 'altoque@amifood.com',
    location: 'Bloque 1, piso 5',
    description: 'Cafes, bebidas, postres y wraps.',
    imageUrl: '/img/al toque.jpg',
  },
  {
    key: 'sandwich special',
    name: 'Sandwich Special',
    email: 'sandwich@amifood.com',
    accountEmail: 'sandwich@amifood.com',
    location: 'Bloque 2, al lado de la biblioteca',
    description: 'Sandwiches, hamburguesas y carnes.',
    imageUrl: '/img/sandwichd.jpeg',
  },
];

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function inferCategory(productName: string): ProductCategory {
  const name = normalizeText(productName);
  if (/(cafe|capuchino|milo|jugo|batido|soda|hatsu|agua|limonada|aromatica|gaseosa)/.test(name)) {
    return 'BEBIDAS';
  }
  if (/(torta|maria luisa|royo|rollo|tarta|croissant|muffin|postre|helado|arequipe)/.test(name)) {
    return 'POSTRES';
  }
  if (/(almuerzo|arroz|bandeja|menu|sopa)/.test(name)) {
    return 'ALMUERZOS';
  }
  if (/(perro|arepa|panseroti|pizza|empanada|pastel|sandwich|sanduche|hamburguesa|wrap|burrito|nachada|taquito|maicito|palito|pan cook|canon|chicharron|pechuga|churrasco|quiche)/.test(name)) {
    return 'COMIDAS_RAPIDAS';
  }
  return 'OTROS';
}

function parseCsv(csvPath: string): Array<{ name: string; priceCents: number; storeKey: string }> {
  if (!existsSync(csvPath)) return [];

  const seen = new Set<string>();
  const result: Array<{ name: string; priceCents: number; storeKey: string }> = [];
  const lines = readFileSync(csvPath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(';');
    if (parts.length < 3) continue;

    const name = parts[0]?.trim().replace(/\s+/g, ' ') ?? '';
    const price = Number.parseFloat(parts[1]?.trim() ?? '');
    const storeKey = normalizeText(parts[2] ?? '');
    if (!name || !Number.isFinite(price) || price <= 0) continue;
    if (!STORES.some((store) => store.key === storeKey)) continue;

    const dedupeKey = `${storeKey}|${normalizeText(name)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    result.push({ name, priceCents: Math.round(price * 100), storeKey });
  }

  return result;
}

function countRows(db: DatabaseSync, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as
    | { total: number | bigint }
    | undefined;
  return Number(row?.total ?? 0);
}

/**
 * Carga inicial reproducible. Crea locales, cuentas (ADMIN y ENCARGADO) y el
 * catalogo del CSV con categorias, stock, popularidad y valoraciones de demo.
 */
export async function seedDatabase(db: DatabaseSync, options: SeedOptions): Promise<SeedResult> {
  const log = options.log ?? ((message: string) => console.log(message));

  if (!options.reset && countRows(db, 'accounts') > 0) {
    return { seeded: false, stores: 0, accounts: 0, products: 0 };
  }

  const storePasswordHash = await options.passwordHasher.hash(DEFAULT_PASSWORD);
  const adminPasswordHash = await options.passwordHasher.hash(ADMIN_PASSWORD);
  const parsedProducts = parseCsv(options.csvPath);
  const now = new Date().toISOString();

  db.exec('BEGIN IMMEDIATE');
  try {
    if (options.reset) {
      db.exec('DELETE FROM price_history; DELETE FROM product_ratings; DELETE FROM products; DELETE FROM accounts; DELETE FROM stores;');
    }

    const storeIds = new Map<string, string>();
    const insertStore = db.prepare(
      `INSERT INTO stores (id, name, description, location, image_url, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    );
    for (const store of STORES) {
      const id = randomUUID();
      storeIds.set(store.key, id);
      insertStore.run(
        id,
        store.name,
        store.description,
        store.location,
        store.imageUrl,
        now,
        now,
      );
    }

    const adminId = randomUUID();
    const insertAccount = db.prepare(
      `INSERT INTO accounts (id, name, email, password_hash, role, store_id, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
    );
    insertAccount.run(
      adminId,
      'Administrador AmiFood',
      'admin@amifood.com',
      adminPasswordHash,
      'ADMIN' satisfies AccountRole,
      null,
      now,
    );
    for (const store of STORES) {
      insertAccount.run(
        randomUUID(),
        `${store.name} - Encargado`,
        store.accountEmail,
        storePasswordHash,
        'ENCARGADO' satisfies AccountRole,
        storeIds.get(store.key) ?? null,
        now,
      );
    }

    const insertProduct = db.prepare(
      `INSERT INTO products (
         id, store_id, name, description, category, price_cents, stock,
         low_stock_threshold, image_url, is_available, rating_sum, rating_count,
         sales_count, status, created_at, updated_at, deleted_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, NULL)`,
    );
    const insertRating = db.prepare(
      `INSERT INTO product_ratings (id, product_id, author_name, score, comment, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const insertPriceHistory = db.prepare(
      `INSERT INTO price_history (
         id, product_id, old_price_cents, new_price_cents, reason,
         changed_by_account_id, changed_by_name, changed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const comments = [
      'Muy buena porcion y sabor.',
      'Relacion precio-calidad excelente.',
      'Llego caliente y rapido.',
      'Volveria a pedirlo.',
      'Buen producto, aunque podria tener mas acompanamiento.',
    ];
    const authors = ['Ana R.', 'Carlos M.', 'Laura G.', 'Juan P.', 'Sofia V.'];

    let productIndex = 0;
    for (const parsed of parsedProducts) {
      const storeId = storeIds.get(parsed.storeKey);
      if (!storeId) continue;

      const hash = stableHash(`${parsed.storeKey}|${parsed.name}`);
      const forcesOutOfStock = productIndex % 17 === 0;
      const stock = forcesOutOfStock ? 0 : 4 + (hash % 28);
      const category = inferCategory(parsed.name);
      const productId = randomUUID();
      const createdAt = new Date(Date.now() - (hash % 45) * 86_400_000).toISOString();
      const salesCount = hash % 120;

      const rated = productIndex % 4 === 0;
      const ratingCount = rated ? 2 + (hash % 2) : 0;
      const ratings: Array<{ score: number; author: string; comment: string; createdAt: string }> = [];
      let ratingSum = 0;
      for (let index = 0; index < ratingCount; index += 1) {
        const score = 3 + ((hash + index) % 3);
        ratingSum += score;
        ratings.push({
          score,
          author: authors[(hash + index) % authors.length] ?? 'Cliente AmiFood',
          comment: comments[(hash + index) % comments.length] ?? 'Buen producto.',
          createdAt: new Date(Date.now() - (index + 1) * 86_400_000).toISOString(),
        });
      }

      insertProduct.run(
        productId,
        storeId,
        parsed.name,
        category === 'BEBIDAS'
          ? 'Bebida preparada del local.'
          : category === 'POSTRES'
            ? 'Postre artesanal del local.'
            : 'Producto preparado en el local.',
        category,
        parsed.priceCents,
        stock,
        5,
        null,
        stock > 0 ? 1 : 0,
        ratingSum,
        ratingCount,
        salesCount,
        createdAt,
        createdAt,
      );

      // Las valoraciones se insertan despues del producto por la FK.
      for (const rating of ratings) {
        insertRating.run(
          randomUUID(),
          productId,
          rating.author,
          rating.score,
          rating.comment,
          rating.createdAt,
        );
      }

      if (productIndex % 10 === 0 && parsed.priceCents > 500) {
        insertPriceHistory.run(
          randomUUID(),
          productId,
          parsed.priceCents - 500,
          parsed.priceCents,
          'Historico de referencia (seed)',
          adminId,
          'Administrador AmiFood',
          new Date(Date.now() - 7 * 86_400_000).toISOString(),
        );
      }

      productIndex += 1;
    }

    db.exec('COMMIT');
    log(`Seed completado: ${STORES.length} locales, ${STORES.length + 1} cuentas, ${productIndex} productos.`);
    if (productIndex < parsedProducts.length) {
      log(`Productos omitidos por duplicado o local inexistente: ${parsedProducts.length - productIndex}.`);
    }

    return {
      seeded: true,
      stores: STORES.length,
      accounts: STORES.length + 1,
      products: productIndex,
    };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export const SEED_CREDENTIALS = {
  admin: { email: 'admin@amifood.com', password: ADMIN_PASSWORD },
  store: { email: 'lafrutera@amifood.com', password: DEFAULT_PASSWORD },
};
