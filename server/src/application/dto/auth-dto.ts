import type { Account } from '../../domain/entities/account.ts';
import type { Store } from '../../domain/entities/store.ts';

export interface LoginCommand {
  email: string;
  password: string;
}

export interface AuthProfile {
  account: Account;
  store: Store | null;
}

export interface LoginResult extends AuthProfile {
  token: string;
  expiresIn: string;
}
