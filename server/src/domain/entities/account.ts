export const ACCOUNT_ROLES = ['ADMIN', 'ENCARGADO'] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export interface Account {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: AccountRole;
  /** null para el administrador global. */
  readonly storeId: string | null;
  readonly isActive: boolean;
}

/** Regla de autorizacion reutilizada por todos los casos de uso. */
export function canManageStore(account: Account, storeId: string): boolean {
  return account.role === 'ADMIN' || account.storeId === storeId;
}
