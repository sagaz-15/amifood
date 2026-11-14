import type {
  AccountCredentials,
  AccountRepository,
} from '../../../../../application/ports/out/account-repository.ts';
import type { Account, AccountRole } from '../../../../../domain/entities/account.ts';
import type { SqliteDatabase } from './database.ts';

interface AccountRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  store_id: string | null;
  is_active: number;
}

/** Adaptador de salida del puerto AccountRepository sobre SQLite. */
export class SqliteAccountRepository implements AccountRepository {
  private readonly db: SqliteDatabase;

  constructor(db: SqliteDatabase) {
    this.db = db;
  }

  async findByEmail(email: string): Promise<Account | null> {
    const row = this.db
      .prepare('SELECT * FROM accounts WHERE lower(email) = lower(?) LIMIT 1')
      .get(email) as AccountRow | undefined;
    return row ? this.toDomain(row) : null;
  }

  async findCredentialsByEmail(email: string): Promise<AccountCredentials | null> {
    const row = this.db
      .prepare('SELECT * FROM accounts WHERE lower(email) = lower(?) LIMIT 1')
      .get(email) as AccountRow | undefined;
    if (!row) return null;
    return { account: this.toDomain(row), passwordHash: row.password_hash };
  }

  async findById(id: string): Promise<Account | null> {
    const row = this.db
      .prepare('SELECT * FROM accounts WHERE id = ? LIMIT 1')
      .get(id) as AccountRow | undefined;
    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: AccountRow): Account {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role as AccountRole,
      storeId: row.store_id,
      isActive: Number(row.is_active) === 1,
    };
  }
}
