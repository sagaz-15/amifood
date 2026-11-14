import type { Account } from '../../domain/entities/account.ts';
import { createPriceChange, type PriceChange } from '../../domain/entities/price-change.ts';
import type { Product } from '../../domain/entities/product.ts';
import { ProductFactory } from '../../domain/factories/product-factory.ts';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../domain/errors/domain-error.ts';
import { Money } from '../../domain/value-objects/money.ts';
import type { Store } from '../../domain/entities/store.ts';
import type {
  CreateProductCommand,
  ListProductsQuery,
  Page,
  ProductDetail,
  ProductListItem,
  ProductSortField,
  SortDirection,
  UpdateProductCommand,
} from '../dto/product-dto.ts';
import type { ProductUseCases } from '../ports/in/product-use-cases.ts';
import type { ProductRepository } from '../ports/out/product-repository.ts';
import type { StoreRepository } from '../ports/out/store-repository.ts';
import type { ProductEventPublisher } from '../ports/out/product-event-bus.ts';
import type { ProductEventType } from '../../domain/events/product-event.ts';

export interface ProductServiceDependencies {
  products: ProductRepository;
  stores: StoreRepository;
  events: ProductEventPublisher;
  factory: ProductFactory;
}

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 10;

function normalizeNameForComparison(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-CO');
}

/**
 * Casos de uso del modulo de productos. Orquesta dominio + puertos,
 * sin conocer Express ni SQL (SRP / DIP).
 */
export class ProductService implements ProductUseCases {
  private readonly products: ProductRepository;
  private readonly stores: StoreRepository;
  private readonly events: ProductEventPublisher;
  private readonly factory: ProductFactory;

  constructor(dependencies: ProductServiceDependencies) {
    this.products = dependencies.products;
    this.stores = dependencies.stores;
    this.events = dependencies.events;
    this.factory = dependencies.factory;
  }

  async list(query: ListProductsQuery): Promise<Page<ProductListItem>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(page) || page < 1) {
      throw new ValidationError('PAGE_INVALID', 'La pagina debe ser un entero mayor o igual a 1.');
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      throw new ValidationError('PAGE_SIZE_INVALID', `El tamaño de pagina debe estar entre 1 y ${MAX_PAGE_SIZE}.`);
    }

    const minPriceCents = query.minPrice === undefined ? undefined : this.toFilterCents(query.minPrice, 'minPrice');
    const maxPriceCents = query.maxPrice === undefined ? undefined : this.toFilterCents(query.maxPrice, 'maxPrice');
    if (minPriceCents !== undefined && maxPriceCents !== undefined && minPriceCents > maxPriceCents) {
      throw new ValidationError('PRICE_RANGE_INVALID', 'El precio minimo no puede ser mayor que el maximo.');
    }

    if (query.storeId) {
      const store = await this.stores.findById(query.storeId);
      if (!store || !store.isActive) {
        throw new NotFoundError('STORE_NOT_FOUND', 'El local indicado no existe o esta inactivo.');
      }
    }

    const result = await this.products.search({
      storeId: query.storeId,
      q: query.q?.trim() || undefined,
      category: query.category,
      available: query.available,
      minPriceCents,
      maxPriceCents,
      sortBy: (query.sortBy ?? 'name') as ProductSortField,
      sortOrder: (query.sortOrder ?? 'asc') as SortDirection,
      page,
      pageSize,
    });

    return this.toPage(result, page, pageSize);
  }

  async listMine(account: Account): Promise<Page<ProductListItem>> {
    const storeId = this.requireStore(account);
    const result = await this.products.search({
      storeId,
      sortBy: 'name',
      sortOrder: 'asc',
      page: 1,
      pageSize: 500,
    });
    return this.toPage(result, 1, 500);
  }

  async getById(id: string): Promise<ProductDetail> {
    const product = await this.findActiveOrThrow(id);
    const [store, reviews] = await Promise.all([
      this.stores.findById(product.storeId),
      this.products.findReviews(product.id, 10),
    ]);
    return { product, store, reviews };
  }

  async create(account: Account, command: CreateProductCommand): Promise<Product> {
    const store = await this.resolveStoreForCreate(account, command.storeId);

    const duplicated = await this.products.findByStoreAndName(store.id, command.name);
    if (duplicated && duplicated.status === 'ACTIVE') {
      throw new ConflictError(
        'PRODUCT_NAME_DUPLICATED',
        `Ya existe un producto llamado "${duplicated.name}" en este local.`,
      );
    }

    const product = this.factory.create({
      storeId: store.id,
      name: command.name,
      description: command.description,
      category: command.category,
      price: Money.fromDecimal(command.price),
      stock: command.stock,
      lowStockThreshold: command.lowStockThreshold,
      imageUrl: command.imageUrl,
      isAvailable: command.isAvailable,
    });

    await this.products.save(product);
    await this.publish('product.created', product);
    return product;
  }

  async update(account: Account, id: string, command: UpdateProductCommand): Promise<Product> {
    const current = await this.findActiveOrThrow(id);
    current.assertCanBeManagedBy(account);

    if (command.name !== undefined) {
      const normalized = normalizeNameForComparison(command.name);
      const duplicated = await this.products.findByStoreAndName(current.storeId, command.name);
      if (duplicated && duplicated.id !== current.id && duplicated.status === 'ACTIVE'
        && normalizeNameForComparison(duplicated.name) === normalized) {
        throw new ConflictError(
          'PRODUCT_NAME_DUPLICATED',
          `Ya existe un producto llamado "${duplicated.name}" en este local.`,
        );
      }
    }

    let updated = current.withDetails({
      name: command.name,
      description: command.description,
      category: command.category,
      imageUrl: command.imageUrl,
      lowStockThreshold: command.lowStockThreshold,
    });

    let priceChange: PriceChange | undefined;
    if (command.price !== undefined) {
      const newPrice = Money.fromDecimal(command.price);
      if (!newPrice.equals(current.price)) {
        updated = updated.withPrice(newPrice, command.reason);
        priceChange = createPriceChange({
          productId: current.id,
          oldPriceCents: current.price.cents,
          newPriceCents: newPrice.cents,
          reason: command.reason,
          accountId: account.id,
          accountName: account.name,
        });
      }
    }

    await this.products.save(updated, priceChange);
    await this.publish('product.updated', updated, priceChange?.reason ?? null);
    return updated;
  }

  async setAvailability(account: Account, id: string, isAvailable: boolean): Promise<Product> {
    const current = await this.findActiveOrThrow(id);
    current.assertCanBeManagedBy(account);

    const updated = current.withAvailability(isAvailable);
    if (updated !== current) {
      await this.products.save(updated);
      await this.publish('product.updated', updated);
    }
    return updated;
  }

  async changePrice(account: Account, id: string, price: number, reason?: string | null): Promise<Product> {
    const current = await this.findActiveOrThrow(id);
    current.assertCanBeManagedBy(account);

    const newPrice = Money.fromDecimal(price);
    if (newPrice.equals(current.price)) return current;

    const updated = current.withPrice(newPrice, reason);
    const priceChange = createPriceChange({
      productId: current.id,
      oldPriceCents: current.price.cents,
      newPriceCents: newPrice.cents,
      reason,
      accountId: account.id,
      accountName: account.name,
    });

    await this.products.save(updated, priceChange);
    await this.publish('product.updated', updated, reason ?? null);
    return updated;
  }

  async adjustStock(account: Account, id: string, delta: number, reason?: string | null): Promise<Product> {
    const current = await this.findActiveOrThrow(id);
    current.assertCanBeManagedBy(account);

    const updated = current.applyStockMovement(delta);
    await this.products.save(updated);
    await this.publish('product.updated', updated, reason ?? null);
    return updated;
  }

  async delete(account: Account, id: string): Promise<void> {
    const current = await this.findActiveOrThrow(id);
    current.assertCanBeManagedBy(account);
    current.assertCanBeDeleted();

    const deleted = current.softDelete();
    await this.products.save(deleted);
    await this.publish('product.deleted', deleted);
  }

  async getPriceHistory(account: Account, id: string): Promise<PriceChange[]> {
    const product = await this.findActiveOrThrow(id);
    product.assertCanBeManagedBy(account);
    return this.products.findPriceHistory(id);
  }

  private async findActiveOrThrow(id: string): Promise<Product> {
    const product = await this.products.findById(id);
    if (!product || product.isDeleted) {
      throw new NotFoundError('PRODUCT_NOT_FOUND', 'El producto no existe o fue eliminado.');
    }
    return product;
  }

  private requireStore(account: Account): string {
    if (!account.storeId) {
      throw new ForbiddenError('ACCOUNT_WITHOUT_STORE', 'La cuenta no esta asociada a un local.');
    }
    return account.storeId;
  }

  private async resolveStoreForCreate(account: Account, requestedStoreId?: string): Promise<Store> {
    let storeId: string;

    if (account.role === 'ADMIN') {
      if (!requestedStoreId) {
        throw new ValidationError('STORE_REQUIRED', 'Un administrador debe indicar el local (storeId).');
      }
      storeId = requestedStoreId;
    } else {
      storeId = this.requireStore(account);
      if (requestedStoreId && requestedStoreId !== storeId) {
        throw new ForbiddenError('PRODUCT_FORBIDDEN', 'No puede crear productos en otro local.');
      }
    }

    const store = await this.stores.findById(storeId);
    if (!store || !store.isActive) {
      throw new NotFoundError('STORE_NOT_FOUND', 'El local indicado no existe o esta inactivo.');
    }
    return store;
  }

  private toFilterCents(value: number, field: string): number {
    if (!Number.isFinite(value) || value < 0 || value > 1_000_000) {
      throw new ValidationError('PRICE_RANGE_INVALID', `${field} debe estar entre 0 y 1.000.000 COP.`);
    }
    return Math.round(value * 100);
  }

  private toPage(
    result: { items: ProductListItem[]; total: number },
    page: number,
    pageSize: number,
  ): Page<ProductListItem> {
    return {
      items: result.items,
      page,
      pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / pageSize),
    };
  }

  /** Publica el evento de dominio (Observer) con el nombre del local resuelto. */
  private async publish(
    type: ProductEventType,
    product: Product,
    detail: string | null = null,
  ): Promise<void> {
    const store = await this.stores.findById(product.storeId);
    this.events.publish({
      type,
      productId: product.id,
      storeId: product.storeId,
      storeName: store?.name ?? null,
      name: product.name,
      price: product.price.toDecimal(),
      stock: product.stock,
      isAvailable: product.isAvailable,
      occurredAt: new Date().toISOString(),
      detail,
    });
  }
}
