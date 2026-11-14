import { canManageStore } from './account.ts';
import type { Account } from './account.ts';
import { Money } from '../value-objects/money.ts';
import {
  ConflictError,
  ForbiddenError,
  ValidationError,
} from '../errors/domain-error.ts';

export const PRODUCT_CATEGORIES = [
  'COMIDAS_RAPIDAS',
  'BEBIDAS',
  'POSTRES',
  'ALMUERZOS',
  'OTROS',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_STATUSES = ['ACTIVE', 'DELETED'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/** Porcentaje de variacion que exige justificacion (RN-06). */
export const PRICE_CHANGE_REASON_THRESHOLD = 20;

export interface CreateProductData {
  storeId: string;
  name: string;
  description?: string | null;
  category: ProductCategory;
  price: Money;
  stock?: number;
  lowStockThreshold?: number;
  imageUrl?: string | null;
  isAvailable?: boolean;
}

export interface RehydrateProductData {
  id: string;
  storeId: string;
  name: string;
  description: string | null;
  category: ProductCategory;
  price: Money;
  stock: number;
  lowStockThreshold: number;
  imageUrl: string | null;
  isAvailable: boolean;
  ratingSum: number;
  ratingCount: number;
  salesCount: number;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

function normalizeName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 120) {
    throw new ValidationError('PRODUCT_NAME_INVALID', 'El nombre debe tener entre 2 y 120 caracteres.');
  }
  return name;
}

function normalizeDescription(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const description = raw.trim();
  if (description.length > 500) {
    throw new ValidationError('PRODUCT_DESCRIPTION_INVALID', 'La descripcion no puede superar 500 caracteres.');
  }
  return description.length === 0 ? null : description;
}

function normalizeImageUrl(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const url = raw.trim();
  if (url.length === 0) return null;
  if (url.length > 500) {
    throw new ValidationError('PRODUCT_IMAGE_INVALID', 'La URL de la imagen no puede superar 500 caracteres.');
  }
  if (!/^(https?:\/\/|\/)/i.test(url)) {
    throw new ValidationError('PRODUCT_IMAGE_INVALID', 'La imagen debe ser una URL http(s) o una ruta absoluta del sitio.');
  }
  return url;
}

function normalizeStock(raw: number): number {
  if (!Number.isInteger(raw) || raw < 0) {
    throw new ValidationError('PRODUCT_STOCK_INVALID', 'El stock debe ser un entero mayor o igual a cero.');
  }
  if (raw > 10_000) {
    throw new ValidationError('PRODUCT_STOCK_INVALID', 'El stock no puede superar 10.000 unidades.');
  }
  return raw;
}

function normalizeThreshold(raw: number): number {
  if (!Number.isInteger(raw) || raw < 0 || raw > 10_000) {
    throw new ValidationError('PRODUCT_THRESHOLD_INVALID', 'El umbral de stock bajo debe ser un entero entre 0 y 10.000.');
  }
  return raw;
}

/**
 * Entidad raiz del agregado Producto. Concentra las reglas de negocio
 * (stock, disponibilidad, precio, autorizacion y borrado logico), por lo que
 * puede probarse sin Express ni SQLite (SRP + DIP).
 */
export class Product {
  readonly id: string;
  readonly storeId: string;
  readonly name: string;
  readonly description: string | null;
  readonly category: ProductCategory;
  readonly price: Money;
  readonly stock: number;
  readonly lowStockThreshold: number;
  readonly imageUrl: string | null;
  readonly isAvailable: boolean;
  readonly ratingSum: number;
  readonly ratingCount: number;
  readonly salesCount: number;
  readonly status: ProductStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;

  constructor(data: RehydrateProductData) {
    if (!Number.isInteger(data.stock) || data.stock < 0) {
      throw new ValidationError('PRODUCT_STOCK_INVALID', 'El stock debe ser un entero mayor o igual a cero.');
    }
    if (!Number.isInteger(data.ratingCount) || data.ratingCount < 0) {
      throw new ValidationError('PRODUCT_RATING_INVALID', 'El conteo de valoraciones no es valido.');
    }
    if (!PRODUCT_CATEGORIES.includes(data.category)) {
      throw new ValidationError('PRODUCT_CATEGORY_INVALID', `Categoria no valida: ${String(data.category)}.`);
    }
    this.id = data.id;
    this.storeId = data.storeId;
    this.name = normalizeName(data.name);
    this.description = normalizeDescription(data.description);
    this.category = data.category;
    this.price = data.price;
    this.stock = data.stock;
    this.lowStockThreshold = normalizeThreshold(data.lowStockThreshold);
    this.imageUrl = normalizeImageUrl(data.imageUrl);
    this.isAvailable = data.stock > 0 && data.isAvailable;
    this.ratingSum = data.ratingSum;
    this.ratingCount = data.ratingCount;
    this.salesCount = data.salesCount;
    this.status = data.status;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
    this.deletedAt = data.deletedAt;
  }

  get ratingAverage(): number | null {
    if (this.ratingCount === 0) return null;
    return Math.round((this.ratingSum / this.ratingCount) * 10) / 10;
  }

  get isLowStock(): boolean {
    return this.lowStockThreshold > 0 && this.stock > 0 && this.stock <= this.lowStockThreshold;
  }

  get isDeleted(): boolean {
    return this.status === 'DELETED';
  }

  /** RN-05: solo el local dueno o un administrador pueden gestionar el producto. */
  assertCanBeManagedBy(account: Account): void {
    if (!canManageStore(account, this.storeId)) {
      throw new ForbiddenError('PRODUCT_FORBIDDEN', 'No puede gestionar productos de otro local.');
    }
  }

  /** RN-03: no se puede publicar como disponible un producto agotado. */
  withAvailability(isAvailable: boolean, now: string = new Date().toISOString()): Product {
    if (isAvailable && this.stock === 0) {
      throw new ConflictError(
        'PRODUCT_OUT_OF_STOCK',
        'No se puede marcar como disponible un producto con stock 0.',
      );
    }
    if (this.isAvailable === isAvailable) return this;
    return this.clone({ isAvailable, updatedAt: now });
  }

  /**
   * RN-02 / RN-03: aplica un movimiento de inventario. Un delta negativo
   * representa una venta y acumula el contador de popularidad (RF04.06).
   */
  applyStockMovement(delta: number, now: string = new Date().toISOString()): Product {
    if (!Number.isInteger(delta) || delta === 0) {
      throw new ValidationError('STOCK_MOVEMENT_INVALID', 'El movimiento de stock debe ser un entero distinto de cero.');
    }
    const newStock = this.stock + delta;
    if (newStock < 0) {
      throw new ConflictError(
        'INSUFFICIENT_STOCK',
        `Stock insuficiente: disponible ${this.stock}, solicitado ${Math.abs(delta)}.`,
      );
    }
    const sold = delta < 0 ? Math.abs(delta) : 0;
    return this.clone({
      stock: normalizeStock(newStock),
      salesCount: this.salesCount + sold,
      isAvailable: newStock === 0 ? false : this.isAvailable,
      updatedAt: now,
    });
  }

  /** RN-06: cambios superiores al 20% exigen motivo y siempre quedan auditados. */
  withPrice(newPrice: Money, reason?: string | null, now: string = new Date().toISOString()): Product {
    if (this.price.equals(newPrice)) return this;
    const variation = newPrice.percentageDifferenceFrom(this.price);
    if (Math.abs(variation) > PRICE_CHANGE_REASON_THRESHOLD && !reason?.trim()) {
      throw new ValidationError(
        'PRICE_CHANGE_REASON_REQUIRED',
        `La variacion de precio es de ${variation.toFixed(1)}%. Los cambios superiores al ${PRICE_CHANGE_REASON_THRESHOLD}% requieren un motivo.`,
      );
    }
    return this.clone({ price: newPrice, updatedAt: now });
  }

  withDetails(input: {
    name?: string;
    description?: string | null;
    category?: ProductCategory;
    imageUrl?: string | null;
    lowStockThreshold?: number;
  }, now: string = new Date().toISOString()): Product {
    return this.clone({
      name: input.name === undefined ? this.name : normalizeName(input.name),
      description: input.description === undefined ? this.description : normalizeDescription(input.description),
      category: input.category ?? this.category,
      imageUrl: input.imageUrl === undefined ? this.imageUrl : normalizeImageUrl(input.imageUrl),
      lowStockThreshold:
        input.lowStockThreshold === undefined
          ? this.lowStockThreshold
          : normalizeThreshold(input.lowStockThreshold),
      updatedAt: now,
    });
  }

  /** RN-07: productos con ventas no se eliminan fisicamente. */
  assertCanBeDeleted(): void {
    if (this.salesCount > 0) {
      throw new ConflictError(
        'PRODUCT_HAS_SALES',
        'El producto tiene ventas registradas; desactívelo en lugar de eliminarlo.',
      );
    }
  }

  /** RN-07: borrado logico para conservar historial e integridad referencial. */
  softDelete(now: string = new Date().toISOString()): Product {
    return this.clone({
      status: 'DELETED',
      deletedAt: now,
      updatedAt: now,
      isAvailable: false,
    });
  }

  private clone(overrides: Partial<RehydrateProductData>): Product {
    return new Product({
      id: this.id,
      storeId: this.storeId,
      name: this.name,
      description: this.description,
      category: this.category,
      price: this.price,
      stock: this.stock,
      lowStockThreshold: this.lowStockThreshold,
      imageUrl: this.imageUrl,
      isAvailable: this.isAvailable,
      ratingSum: this.ratingSum,
      ratingCount: this.ratingCount,
      salesCount: this.salesCount,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
      ...overrides,
    });
  }
}
