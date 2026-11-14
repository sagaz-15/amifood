import type {
  ProductRepository,
  ProductSearchCriteria,
  ProductSearchResult,
} from '../../../../../application/ports/out/product-repository.ts';
import type { ProductListItem } from '../../../../../application/dto/product-dto.ts';
import type { ProductSortField } from '../../../../../application/dto/product-dto.ts';
import type { Product } from '../../../../../domain/entities/product.ts';
import type { ProductCategory, ProductStatus } from '../../../../../domain/entities/product.ts';
import type { PriceChange } from '../../../../../domain/entities/price-change.ts';
import type { ProductReview } from '../../../../../domain/entities/product-review.ts';
import { ConflictError } from '../../../../../domain/errors/domain-error.ts';
import { ProductFactory } from '../../../../../domain/factories/product-factory.ts';
import { Money } from '../../../../../domain/value-objects/money.ts';
import type { SqliteDatabase } from './database.ts';

interface ProductRow {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  category: string;
  price_cents: number;
  stock: number;
  low_stock_threshold: number;
  image_url: string | null;
  is_available: number;
  rating_sum: number;
  rating_count: number;
  sales_count: number;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  store_name?: string;
}

interface PriceHistoryRow {
  id: string;
  product_id: string;
  old_price_cents: number;
  new_price_cents: number;
  reason: string | null;
  changed_by_account_id: string;
  changed_by_name: string;
  changed_at: string;
}

interface ReviewRow {
  id: string;
  product_id: string;
  author_name: string;
  score: number;
  comment: string | null;
  created_at: string;
}

type SqlParam = string | number;
type ProductSortKey = ProductSortField;

/**
 * ADAPTADOR DE SALIDA (driven adapter): implementa el puerto ProductRepository
 * sobre SQLite. Todo el SQL vive aqui; el dominio permanece intacto si mañana
 * se cambia a SQL Server o MongoDB.
 */
export class SqliteProductRepository implements ProductRepository {
  private readonly db: SqliteDatabase;
  private readonly factory: ProductFactory;

  constructor(db: SqliteDatabase, factory: ProductFactory) {
    this.db = db;
    this.factory = factory;
  }

  async findById(id: string): Promise<Product | null> {
    const row = this.db
      .prepare("SELECT * FROM products WHERE id = ? AND status = 'ACTIVE'")
      .get(id) as ProductRow | undefined;
    return row ? this.toDomain(row) : null;
  }

  async findByStoreAndName(storeId: string, name: string): Promise<Product | null> {
    const normalized = name.trim().replace(/\s+/g, ' ');
    const row = this.db
      .prepare(
        `SELECT * FROM products
         WHERE store_id = ? AND status = 'ACTIVE' AND lower(name) = lower(?)
         LIMIT 1`,
      )
      .get(storeId, normalized) as ProductRow | undefined;
    return row ? this.toDomain(row) : null;
  }

  async search(criteria: ProductSearchCriteria): Promise<ProductSearchResult> {
    const where: string[] = ["p.status = 'ACTIVE'", 's.is_active = 1'];
    const params: SqlParam[] = [];

    if (criteria.storeId) {
      where.push('p.store_id = ?');
      params.push(criteria.storeId);
    }
    if (criteria.q) {
      where.push("(lower(p.name) LIKE ? OR lower(COALESCE(p.description, '')) LIKE ?)");
      const term = `%${criteria.q.toLocaleLowerCase('es-CO')}%`;
      params.push(term, term);
    }
    if (criteria.category) {
      where.push('p.category = ?');
      params.push(criteria.category);
    }
    if (criteria.available !== undefined) {
      where.push('p.is_available = ?');
      params.push(criteria.available ? 1 : 0);
    }
    if (criteria.minPriceCents !== undefined) {
      where.push('p.price_cents >= ?');
      params.push(criteria.minPriceCents);
    }
    if (criteria.maxPriceCents !== undefined) {
      where.push('p.price_cents <= ?');
      params.push(criteria.maxPriceCents);
    }

    const from = `FROM products p
      JOIN stores s ON s.id = p.store_id
      WHERE ${where.join(' AND ')}`;

    const totalRow = this.db
      .prepare(`SELECT COUNT(*) AS total ${from}`)
      .get(...params) as { total: number | bigint } | undefined;
    const total = Number(totalRow?.total ?? 0);

    const sortColumns: Record<ProductSortKey, string> = {
      name: 'p.name COLLATE NOCASE',
      price: 'p.price_cents',
      popularity: 'p.sales_count',
      rating:
        'CASE WHEN p.rating_count = 0 THEN 0 ELSE (CAST(p.rating_sum AS REAL) / p.rating_count) END',
    };
    const sortColumn = sortColumns[criteria.sortBy] ?? sortColumns.name;
    const direction = criteria.sortOrder === 'desc' ? 'DESC' : 'ASC';
    const limit = criteria.pageSize;
    const offset = (criteria.page - 1) * criteria.pageSize;

    const rows = this.db
      .prepare(
        `SELECT p.*, s.name AS store_name ${from}
         ORDER BY ${sortColumn} ${direction}, p.name COLLATE NOCASE ASC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as unknown as ProductRow[];

    const items: ProductListItem[] = rows.map((row) => ({
      product: this.toDomain(row),
      storeName: String(row.store_name ?? ''),
    }));

    return { items, total };
  }

  async save(product: Product, priceChange?: PriceChange): Promise<void> {
    const upsert = this.db.prepare(`
      INSERT INTO products (
        id, store_id, name, description, category, price_cents, stock,
        low_stock_threshold, image_url, is_available, rating_sum, rating_count,
        sales_count, status, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        store_id = excluded.store_id,
        name = excluded.name,
        description = excluded.description,
        category = excluded.category,
        price_cents = excluded.price_cents,
        stock = excluded.stock,
        low_stock_threshold = excluded.low_stock_threshold,
        image_url = excluded.image_url,
        is_available = excluded.is_available,
        rating_sum = excluded.rating_sum,
        rating_count = excluded.rating_count,
        sales_count = excluded.sales_count,
        status = excluded.status,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at
    `);

    this.db.exec('BEGIN IMMEDIATE');
    try {
      upsert.run(
        product.id,
        product.storeId,
        product.name,
        product.description,
        product.category,
        product.price.cents,
        product.stock,
        product.lowStockThreshold,
        product.imageUrl,
        product.isAvailable ? 1 : 0,
        product.ratingSum,
        product.ratingCount,
        product.salesCount,
        product.status,
        product.createdAt,
        product.updatedAt,
        product.deletedAt,
      );

      if (priceChange) {
        this.db
          .prepare(
            `INSERT INTO price_history (
               id, product_id, old_price_cents, new_price_cents, reason,
               changed_by_account_id, changed_by_name, changed_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            priceChange.id,
            priceChange.productId,
            priceChange.oldPriceCents,
            priceChange.newPriceCents,
            priceChange.reason,
            priceChange.changedByAccountId,
            priceChange.changedByName,
            priceChange.changedAt,
          );
      }

      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw this.translateError(error);
    }
  }

  async findPriceHistory(productId: string): Promise<PriceChange[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM price_history
         WHERE product_id = ?
         ORDER BY changed_at DESC`,
      )
      .all(productId) as unknown as PriceHistoryRow[];

    return rows.map((row) => ({
      id: row.id,
      productId: row.product_id,
      oldPriceCents: Number(row.old_price_cents),
      newPriceCents: Number(row.new_price_cents),
      reason: row.reason,
      changedByAccountId: row.changed_by_account_id,
      changedByName: row.changed_by_name,
      changedAt: row.changed_at,
    }));
  }

  async findReviews(productId: string, limit = 10): Promise<ProductReview[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM product_ratings
         WHERE product_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .all(productId, limit) as unknown as ReviewRow[];

    return rows.map((row) => ({
      id: row.id,
      productId: row.product_id,
      authorName: row.author_name,
      score: Number(row.score),
      comment: row.comment,
      createdAt: row.created_at,
    }));
  }

  private toDomain(row: ProductRow): Product {
    return this.factory.rehydrate({
      id: row.id,
      storeId: row.store_id,
      name: row.name,
      description: row.description,
      category: row.category as ProductCategory,
      price: Money.fromCents(Number(row.price_cents)),
      stock: Number(row.stock),
      lowStockThreshold: Number(row.low_stock_threshold),
      imageUrl: row.image_url,
      isAvailable: Number(row.is_available) === 1,
      ratingSum: Number(row.rating_sum),
      ratingCount: Number(row.rating_count),
      salesCount: Number(row.sales_count),
      status: row.status as ProductStatus,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    });
  }

  private translateError(error: unknown): unknown {
    if (error instanceof Error && error.message.includes('ux_products_store_name')) {
      return new ConflictError(
        'PRODUCT_NAME_DUPLICATED',
        'Ya existe un producto con ese nombre en este local.',
      );
    }
    return error;
  }
}
