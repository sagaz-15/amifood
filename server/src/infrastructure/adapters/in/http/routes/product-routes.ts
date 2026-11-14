import { Router } from 'express';
import type { AuthenticationMiddleware } from '../middleware/authentication-middleware.ts';
import { validate } from '../middleware/validate.ts';
import type { ProductController } from '../controllers/product-controller.ts';
import {
  adjustStockSchema,
  createProductSchema,
  listProductsQuerySchema,
  productIdParamsSchema,
  updateAvailabilitySchema,
  updatePriceSchema,
  updateProductSchema,
} from '../schemas/product-schemas.ts';

/**
 * Tabla de ruteo del recurso Producto. Las rutas literales se registran antes
 * de /:id para evitar colisiones. Escrituras protegidas con JWT.
 */
export function createProductRouter(
  controller: ProductController,
  authentication: AuthenticationMiddleware,
): Router {
  const router = Router();

  // Tiempo real (RF04.13) - publico, solo emite cambios de catalogo.
  router.get('/events', controller.streamEvents);

  // Productos del local autenticado (panel del encargado).
  router.get('/mine', authentication.handle, controller.listMine);

  // Consulta publica con filtros combinados, orden y paginacion.
  router.get('/', validate({ query: listProductsQuerySchema }), controller.list);

  // Crear producto (201).
  router.post(
    '/',
    authentication.handle,
    validate({ body: createProductSchema }),
    controller.create,
  );

  // Detalle publico.
  router.get(
    '/:id',
    validate({ params: productIdParamsSchema }),
    controller.getById,
  );

  // Actualizacion completa (datos + precio opcional).
  router.put(
    '/:id',
    authentication.handle,
    validate({ params: productIdParamsSchema, body: updateProductSchema }),
    controller.update,
  );

  // Regla de negocio: no se puede activar un producto sin stock.
  router.patch(
    '/:id/availability',
    authentication.handle,
    validate({ params: productIdParamsSchema, body: updateAvailabilitySchema }),
    controller.setAvailability,
  );

  // Regla de negocio: cambios > 20% exigen motivo y quedan auditados.
  router.patch(
    '/:id/price',
    authentication.handle,
    validate({ params: productIdParamsSchema, body: updatePriceSchema }),
    controller.changePrice,
  );

  // Regla de negocio: no se puede vender sin stock.
  router.post(
    '/:id/stock-adjustments',
    authentication.handle,
    validate({ params: productIdParamsSchema, body: adjustStockSchema }),
    controller.adjustStock,
  );

  // Auditoria del precio vigente (RF04.08).
  router.get(
    '/:id/price-history',
    authentication.handle,
    validate({ params: productIdParamsSchema }),
    controller.priceHistory,
  );

  // Borrado logico (204).
  router.delete(
    '/:id',
    authentication.handle,
    validate({ params: productIdParamsSchema }),
    controller.remove,
  );

  return router;
}
