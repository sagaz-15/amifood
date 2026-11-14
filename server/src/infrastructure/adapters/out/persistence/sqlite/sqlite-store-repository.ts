import type { StoreRepository } from '../../../../../application/ports/out/store-repository.ts';
import type { Store } from '../../../../../domain/entities/store.ts';
import type { SqliteDatabase } from './database.ts';

interface StoreRow {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  image_url: string | null;
  is_active: number;
}

/** Adaptador de salida del puerto StoreRepository sobre SQLite. */
export class SqliteStoreRepository implements StoreRepository {
  private readonly db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  async findById(id: string): Promise<Store | null> {
    const row = this.db
      .prepare(
        `SELECT id, name, description, location, image_url, is_active
         FROM stores WHERE id = ? LIMIT 1`,
      )
      .get(id) as StoreRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      location: row.location,
      imageUrl: row.image_url,
      isActive: Number(row.is_active) === 1,
    };
  }
}
