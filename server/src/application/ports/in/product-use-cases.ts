import type { Account } from '../../../domain/entities/account.ts';
import type { PriceChange } from '../../../domain/entities/price-change.ts';
import type { Product } from '../../../domain/entities/product.ts';
import type {
  CreateProductCommand,
  ListProductsQuery,
  Page,
  ProductDetail,
  ProductListItem,
  UpdateProductCommand,
} from '../../dto/product-dto.ts';

/**
 * PUERTO DE ENTRADA. El adaptador HTTP (y cualquier otro adaptador futuro:
 * CLI, gRPC, cola) depende de esta interfaz, no de la implementacion.
 */
export interface ProductUseCases {
  list(query: ListProductsQuery): Promise<Page<ProductListItem>>;
  listMine(account: Account): Promise<Page<ProductListItem>>;
  getById(id: string): Promise<ProductDetail>;
  create(account: Account, command: CreateProductCommand): Promise<Product>;
  update(account: Account, id: string, command: UpdateProductCommand): Promise<Product>;
  setAvailability(account: Account, id: string, isAvailable: boolean): Promise<Product>;
  changePrice(account: Account, id: string, price: number, reason?: string | null): Promise<Product>;
  adjustStock(account: Account, id: string, delta: number, reason?: string | null): Promise<Product>;
  delete(account: Account, id: string): Promise<void>;
  getPriceHistory(account: Account, id: string): Promise<PriceChange[]>;
}
