import { randomUUID } from 'node:crypto';
import { Product } from '../entities/product.ts';
import type { CreateProductData, RehydrateProductData } from '../entities/product.ts';
import { ValidationError } from '../errors/domain-error.ts';

/**
 * FACTORY (patron de creacion).
 *
 * Problema que resuelve: la entidad Producto tiene muchas invariantes
 * (stock/disponibilidad, precio en centavos, estado, timestamps, valores por
 * defecto). Sin una fabrica, cada caso de uso y cada repositorio repetiria esa
 * construccion. Aqui se centraliza la creacion valida y la rehidratacion desde
 * persistencia (DRY + SRP).
 */
export class ProductFactory {
  create(input: CreateProductData): Product {
    const stock = input.stock ?? 0;
    if (!Number.isInteger(stock) || stock < 0) {
      throw new ValidationError('PRODUCT_STOCK_INVALID', 'El stock debe ser un entero mayor o igual a cero.');
    }

    const isAvailable = input.isAvailable ?? stock > 0;
    if (isAvailable && stock === 0) {
      throw new ValidationError(
        'PRODUCT_OUT_OF_STOCK',
        'No se puede crear un producto disponible sin stock.',
      );
    }

    const now = new Date().toISOString();
    return new Product({
      id: randomUUID(),
      storeId: input.storeId,
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      price: input.price,
      stock,
      lowStockThreshold: input.lowStockThreshold ?? 0,
      imageUrl: input.imageUrl ?? null,
      isAvailable,
      ratingSum: 0,
      ratingCount: 0,
      salesCount: 0,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  /** Reconstruye la entidad desde la base de datos sin generar un nuevo id. */
  rehydrate(data: RehydrateProductData): Product {
    return new Product(data);
  }
}
