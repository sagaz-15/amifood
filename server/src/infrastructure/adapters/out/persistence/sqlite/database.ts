import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type SqliteDatabase = DatabaseSync;

/**
 * Abre la base SQLite. La instancia se crea UNA sola vez en el composition
 * root y se inyecta en los repositorios (ciclo de vida singleton).
 */
export function openDatabase(file: string): SqliteDatabase {
  if (file !== ':memory:') {
    mkdirSync(dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  return db;
}

export function runMigrations(db: SqliteDatabase): void {
  const schema = readFileSync(join(import.meta.dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
}
