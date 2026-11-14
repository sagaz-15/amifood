import type { Request, Response } from 'express';
import type { ProductEventSubscriber } from '../../../../../application/ports/out/product-event-bus.ts';
import type { ProductEvent } from '../../../../../domain/events/product-event.ts';

/**
 * Adaptador de SALIDA/notificacion: observador que reenvia los eventos de
 * dominio a los clientes conectados por Server-Sent Events.
 * Implementa RF04.13 (actualizacion en tiempo real) sin que el dominio
 * sepa que el transporte es HTTP.
 */
export class SseProductNotifier implements ProductEventSubscriber {
  private readonly clients = new Set<Response>();

  attach = (req: Request, res: Response): void => {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    this.clients.add(res);
    res.write(': conectado a amifood-events\n\n');

    const heartbeat = setInterval(() => {
      res.write(': ping\n\n');
    }, 25_000);
    heartbeat.unref?.();

    req.on('close', () => {
      clearInterval(heartbeat);
      this.clients.delete(res);
      res.end();
    });
  };

  onProductEvent(event: ProductEvent): void {
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }
}
