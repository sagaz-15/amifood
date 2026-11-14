import type { AccountRole } from '../../../domain/entities/account.ts';

export interface TokenClaims {
  accountId: string;
  name: string;
  email: string;
  role: AccountRole;
  storeId: string | null;
}

/** PUERTO DE SALIDA para emision/verificacion de tokens (JWT). */
export interface TokenService {
  sign(claims: TokenClaims): string;
  verify(token: string): TokenClaims;
}
