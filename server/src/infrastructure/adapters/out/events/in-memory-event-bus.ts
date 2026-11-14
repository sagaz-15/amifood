import type {
  ProductEventBus,
  ProductEventSubscriber,
} from '../../../../application/ports/out/product-event-bus.ts';
import type { ProductEvent } from '../../../../domain/events/product-event.ts';

/**
 * OBSERVER (Subject / publicador de eventos).
 *
 * Problema que resuelve: cuando cambia un producto hay varios interesados
 * (notificar por SSE para RF04.13, registrar auditoria, futuras notificaciones
 * push) y no queremos que el caso de uso los conozca. Los observadores se
 * suscriben y el bus los notifica; agregar uno nuevo no modifica el dominio
 * (OCP + DIP).
 */
export class InMemoryEventBus implements ProductEventBus {
  private readonly subscribers = new Set<ProductEventSubscriber>();

  subscribe(subscriber: ProductEventSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  publish(event: ProductEvent): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber.onProductEvent(event);
      } catch (error) {
        // Un observador defectuoso no debe tumbar la operacion de negocio.
        console.error('[events] Error en suscriptor:', error);
      }
    }
  }
}
