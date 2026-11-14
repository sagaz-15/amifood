import type { ProductEvent } from '../../../domain/events/product-event.ts';

/** PUERTO DE SALIDA: publicar eventos de dominio (patron Observer). */
export interface ProductEventPublisher {
  publish(event: ProductEvent): void;
}

/** Contrato que implementan los observadores (SSE, auditoria, etc.). */
export interface ProductEventSubscriber {
  onProductEvent(event: ProductEvent): void;
}

/** Puerto de salida extendido para registrar observadores. */
export interface ProductEventBus extends ProductEventPublisher {
  subscribe(subscriber: ProductEventSubscriber): () => void;
}
