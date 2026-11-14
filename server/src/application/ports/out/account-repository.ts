import type { Account } from '../../../domain/entities/account.ts';

export interface AccountCredentials {
  account: Account;
  passwordHash: string;
}

/** PUERTO DE SALIDA para cuentas. */
export interface AccountRepository {
  findByEmail(email: string): Promise<Account | null>;
  findCredentialsByEmail(email: string): Promise<AccountCredentials | null>;
  findById(id: string): Promise<Account | null>;
}
