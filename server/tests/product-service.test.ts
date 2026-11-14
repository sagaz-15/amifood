import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProductService } from '../src/application/services/product-service.ts';
import type {
  ProductRepository,
  ProductSearchCriteria,
  ProductSearchResult,
} from '../src/application/ports/out/product-repository.ts';
import type { ProductEventPublisher } from '../src/application/ports/out/product-event-bus.ts';
import type { StoreRepository } from '../src/application/ports/out/store-repository.ts';
import type { Account } from '../src/domain/entities/account.ts';
import type { PriceChange } from '../src/domain/entities/price-change.ts';
import type { Product } from '../src/domain/entities/product.ts';
import type { ProductReview } from '../src/domain/entities/product-review.ts';
import type { Store } from '../src/domain/entities/store.ts';
import type { ProductEvent } from '../src/domain/events/product-event.ts';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../src/domain/errors/domain-error.ts';
import { ProductFactory } from '../src/domain/factories/product-factory.ts';

const STORE_A: Store = {
  id: 'store-a',
  name: 'Local A',
  description: null,
  location: 'Bloque 1',
  imageUrl: null,
  isActive: true,
};

const STORE_B: Store = { ...STORE_A, id: 'store-b', name: 'Local B' };

const OWNER: Account = {
  id: 'account-a',
  name: 'Encargado A',
  email: 'a@amifood.com',
  role: 'ENCARGADO',
  storeId: STORE_A.id,
  isActive: true,
};

const OTHER_OWNER: Account = { ...OWNER, id: 'account-b', email: 'b@amifood.com', storeId: STORE_B.id };
const ADMIN: Account = {
  id: 'account-admin',
  name: 'Administrador',
  email: 'admin@amifood.com',
  role: 'ADMIN',
  storeId: null,
  isActive: true,
};

class FakeProductRepository implements ProductRepository {
  readonly products = new Map<string, Product>();
  readonly history: PriceChange[] = [];
  lastCriteria: ProductSearchCriteria | null = null;

  async findById(id: string): Promise<Product | null> {
    const product = this.products.get(id);
    return product && product.status === 'ACTIVE' ? product : null;
  }

  async findByStoreAndName(storeId: string, name: string): Promise<Product | null> {
    const normalized = name.trim().replace(/\s+/g, ' ').toLowerCase();
    for (const product of this.products.values()) {
      if (
        product.storeId === storeId &&
        product.status === 'ACTIVE' &&
        product.name.trim().replace(/\s+/g, ' ').toLowerCase() === normalized
      ) {
        return product;
      }
    }
    return null;
  }

  async search(criteria: ProductSearchCriteria): Promise<ProductSearchResult> {
    this.lastCriteria = criteria;
    let items = [...this.products.values()]
      .filter((product) => product.status === 'ACTIVE')
      .filter((product) => !criteria.storeId || product.storeId === criteria.storeId)
      .filter((product) => !criteria.category || product.category === criteria.category)
      .filter((product) => criteria.available === undefined || product.isAvailable === criteria.available)
      .filter((product) => criteria.minPriceCents === undefined || product.price.cents >= criteria.minPriceCents)
      .filter((product) => criteria.maxPriceCents === undefined || product.price.cents <= criteria.maxPriceCents)
      .filter((product) => {
        if (!criteria.q) return true;
        return product.name.toLowerCase().includes(criteria.q.toLowerCase());
      })
      .map((product) => ({ product, storeName: product.storeId === STORE_A.id ? STORE_A.name : STORE_B.name }));

    items = items.sort((left, right) => {
      const direction = criteria.sortOrder === 'desc' ? -1 : 1;
      if (criteria.sortBy === 'price') {
        return (left.product.price.cents - right.product.price.cents) * direction;
      }
      if (criteria.sortBy === 'popularity') {
        return (left.product.salesCount - right.product.salesCount) * direction;
      }
      return left.product.name.localeCompare(right.product.name) * direction;
    });

    const start = (criteria.page - 1) * criteria.pageSize;
    return { items: items.slice(start, start + criteria.pageSize), total: items.length };
  }

  async save(product: Product, priceChange?: PriceChange): Promise<void> {
    this.products.set(product.id, product);
    if (priceChange) this.history.push(priceChange);
  }

  async findPriceHistory(productId: string): Promise<PriceChange[]> {
    return this.history.filter((change) => change.productId === productId);
  }

  async findReviews(productId: string): Promise<ProductReview[]> {
    return [];
  }
}

class FakeStoreRepository implements StoreRepository {
  async findById(id: string): Promise<Store | null> {
    if (id === STORE_A.id) return STORE_A;
    if (id === STORE_B.id) return STORE_B;
    return null;
  }
}

class FakeEventPublisher implements ProductEventPublisher {
  readonly events: ProductEvent[] = [];
  publish(event: ProductEvent): void {
    this.events.push(event);
  }
}

function setup() {
  const products = new FakeProductRepository();
  const stores = new FakeStoreRepository();
  const events = new FakeEventPublisher();
  const service = new ProductService({
    products,
    stores,
    events,
    factory: new ProductFactory(),
  });
  return { products, stores, events, service };
}

async function createBasicProduct(service: ProductService, overrides: Record<string, unknown> = {}) {
  return service.create(OWNER, {
    name: 'Perro caliente',
    category: 'COMIDAS_RAPIDAS',
    price: 5000,
    stock: 10,
    ...overrides,
  });
}

test('crea un producto valido y publica product.created', async () => {
  const { service, events } = setup();
  const product = await createBasicProduct(service);

  assert.equal(product.name, 'Perro caliente');
  assert.equal(product.price.cents, 500_000);
  assert.equal(product.stock, 10);
  assert.equal(product.isAvailable, true);
  assert.equal(events.events.length, 1);
  assert.equal(events.events[0]?.type, 'product.created');
});

test('rechaza nombre duplicado en el mismo local sin distinguir mayusculas', async () => {
  const { service } = setup();
  await createBasicProduct(service);

  await assert.rejects(
    () => createBasicProduct(service, { name: '  PERRO   CALIENTE ' }),
    (error: unknown) => error instanceof ConflictError && error.code === 'PRODUCT_NAME_DUPLICATED',
  );
});

test('no permite crear un producto disponible con stock cero', async () => {
  const { service } = setup();
  await assert.rejects(
    () => createBasicProduct(service, { stock: 0, isAvailable: true }),
    (error: unknown) => error instanceof ValidationError && error.code === 'PRODUCT_OUT_OF_STOCK',
  );
});

test('no permite activar un producto agotado (RN-03)', async () => {
  const { service } = setup();
  const product = await createBasicProduct(service, { stock: 2 });
  await service.adjustStock(OWNER, product.id, -2, 'Venta');

  await assert.rejects(
    () => service.setAvailability(OWNER, product.id, true),
    (error: unknown) => error instanceof ConflictError && error.code === 'PRODUCT_OUT_OF_STOCK',
  );
});

test('no permite vender mas stock del disponible (RN-02)', async () => {
  const { service } = setup();
  const product = await createBasicProduct(service, { stock: 3 });

  await assert.rejects(
    () => service.adjustStock(OWNER, product.id, -4, 'Venta'),
    (error: unknown) => error instanceof ConflictError && error.code === 'INSUFFICIENT_STOCK',
  );
});

test('una venta acumula popularidad y stock cero desactiva disponibilidad', async () => {
  const { service } = setup();
  const product = await createBasicProduct(service, { stock: 3 });

  const afterSale = await service.adjustStock(OWNER, product.id, -2, 'Venta de mostrador');
  assert.equal(afterSale.stock, 1);
  assert.equal(afterSale.salesCount, 2);
  assert.equal(afterSale.isAvailable, true);

  const soldOut = await service.adjustStock(OWNER, product.id, -1, 'Ultima venta');
  assert.equal(soldOut.stock, 0);
  assert.equal(soldOut.isAvailable, false);
});

test('un cambio de precio mayor al 20% exige motivo (RN-06)', async () => {
  const { service } = setup();
  const product = await createBasicProduct(service, { price: 10_000 });

  await assert.rejects(
    () => service.changePrice(OWNER, product.id, 13_000),
    (error: unknown) => error instanceof ValidationError && error.code === 'PRICE_CHANGE_REASON_REQUIRED',
  );

  const updated = await service.changePrice(OWNER, product.id, 13_000, 'Ajuste por inflacion');
  assert.equal(updated.price.cents, 1_300_000);
});

test('todo cambio de precio queda auditado y emite evento', async () => {
  const { service, products, events } = setup();
  const product = await createBasicProduct(service, { price: 10_000 });

  await service.changePrice(OWNER, product.id, 12_000, 'Actualizacion de carta');

  assert.equal(products.history.length, 1);
  assert.equal(products.history[0]?.oldPriceCents, 1_000_000);
  assert.equal(products.history[0]?.newPriceCents, 1_200_000);
  assert.equal(products.history[0]?.reason, 'Actualizacion de carta');
  assert.equal(events.events.at(-1)?.detail, 'Actualizacion de carta');
});

test('un encargado no puede gestionar productos de otro local (RN-05)', async () => {
  const { service } = setup();
  const product = await createBasicProduct(service);

  await assert.rejects(
    () => service.changePrice(OTHER_OWNER, product.id, 6000),
    (error: unknown) => error instanceof ForbiddenError && error.code === 'PRODUCT_FORBIDDEN',
  );

  const updated = await service.changePrice(ADMIN, product.id, 6000);
  assert.equal(updated.price.cents, 600_000);
});

test('no elimina un producto con ventas y conserva historial (RN-07)', async () => {
  const { service } = setup();
  const sold = await createBasicProduct(service, { stock: 5 });
  await service.adjustStock(OWNER, sold.id, -1, 'Venta');

  await assert.rejects(
    () => service.delete(OWNER, sold.id),
    (error: unknown) => error instanceof ConflictError && error.code === 'PRODUCT_HAS_SALES',
  );

  const unsold = await createBasicProduct(service, { name: 'Jugo natural', stock: 5, price: 4000 });
  await service.delete(OWNER, unsold.id);
  await assert.rejects(
    () => service.getById(unsold.id),
    (error: unknown) => error instanceof NotFoundError && error.code === 'PRODUCT_NOT_FOUND',
  );
});

test('valida rangos de precio y tamano de pagina', async () => {
  const { service } = setup();
  await assert.rejects(
    () => service.list({ minPrice: 50_000, maxPrice: 10_000 }),
    (error: unknown) => error instanceof ValidationError && error.code === 'PRICE_RANGE_INVALID',
  );
  await assert.rejects(
    () => service.list({ pageSize: 200 }),
    (error: unknown) => error instanceof ValidationError && error.code === 'PAGE_SIZE_INVALID',
  );
});

test('traduce filtros combinados a criterios de busqueda', async () => {
  const { service, products } = setup();
  await createBasicProduct(service, { name: 'Cafe americano', category: 'BEBIDAS', price: 3000, stock: 5 });
  await createBasicProduct(service, { name: 'Capuchino', category: 'BEBIDAS', price: 6000, stock: 5 });

  const page = await service.list({
    q: 'cafe',
    category: 'BEBIDAS',
    available: true,
    minPrice: 2000,
    maxPrice: 4000,
    sortBy: 'price',
    sortOrder: 'desc',
    page: 1,
    pageSize: 10,
  });

  assert.equal(page.total, 1);
  assert.equal(page.items[0]?.product.name, 'Cafe americano');
  assert.equal(products.lastCriteria?.category, 'BEBIDAS');
  assert.equal(products.lastCriteria?.minPriceCents, 200_000);
});
