export const PRODUCT_EVENT_TYPES = [
  'product.created',
  'product.updated',
  'product.deleted',
] as const;

export type ProductEventType = (typeof PRODUCT_EVENT_TYPES)[number];

/**
 * Evento de dominio publicado cuando cambia un producto.
 * Habilita la actualizacion en tiempo real (RF04.13) sin acoplar
 * el dominio al transporte usado (SSE, WebSocket, cola, etc.).
 */
export interface ProductEvent {
  readonly type: ProductEventType;
  readonly productId: string;
  readonly storeId: string;
  readonly storeName: string | null;
  readonly name: string;
  readonly price: number;
  readonly stock: number;
  readonly isAvailable: boolean;
  readonly occurredAt: string;
  /** Motivo del cambio (auditoria de precio o de inventario). */
  readonly detail: string | null;
}
