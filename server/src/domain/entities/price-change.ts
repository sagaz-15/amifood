import { randomUUID } from 'node:crypto';

/**
 * Registro de auditoria del precio vigente (RF04.08).
 * Permite reconstruir el historial de precios de un producto.
 */
export interface PriceChange {
  readonly id: string;
  readonly productId: string;
  readonly oldPriceCents: number;
  readonly newPriceCents: number;
  readonly reason: string | null;
  readonly changedByAccountId: string;
  readonly changedByName: string;
  readonly changedAt: string;
}

export function createPriceChange(input: {
  productId: string;
  oldPriceCents: number;
  newPriceCents: number;
  reason?: string | null;
  accountId: string;
  accountName: string;
  changedAt?: string;
}): PriceChange {
  return {
    id: randomUUID(),
    productId: input.productId,
    oldPriceCents: input.oldPriceCents,
    newPriceCents: input.newPriceCents,
    reason: input.reason?.trim() || null,
    changedByAccountId: input.accountId,
    changedByName: input.accountName,
    changedAt: input.changedAt ?? new Date().toISOString(),
  };
}
