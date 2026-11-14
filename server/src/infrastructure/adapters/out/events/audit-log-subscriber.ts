import type { ProductEventSubscriber } from '../../../../application/ports/out/product-event-bus.ts';
import type { ProductEvent } from '../../../../domain/events/product-event.ts';

/** Observador concreto: deja traza de auditoria de cada cambio de producto. */
export class AuditLogSubscriber implements ProductEventSubscriber {
  onProductEvent(event: ProductEvent): void {
    const detail = event.detail ? ` motivo="${event.detail}"` : '';
    console.log(
      `[audit] ${event.occurredAt} ${event.type} product=${event.productId} ` +
        `store=${event.storeId} precio=${event.price} stock=${event.stock} ` +
        `disponible=${event.isAvailable}${detail}`,
    );
  }
}
