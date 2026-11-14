import type { ProductSortField, ProductListItem, SortDirection } from '../../dto/product-dto.ts';
import type { PriceChange } from '../../../domain/entities/price-change.ts';
import type { Product } from '../../../domain/entities/product.ts';
import type { ProductReview } from '../../../domain/entities/product-review.ts';

export interface ProductSearchCriteria {
  storeId?: string;
  q?: string;
  category?: string;
  available?: boolean;
  minPriceCents?: number;
  maxPriceCents?: number;
  sortBy: ProductSortField;
  sortOrder: SortDirection;
  page: number;
  pageSize: number;
}

export interface ProductSearchResult {
  items: ProductListItem[];
  total: number;
}

/**
 * PUERTO DE SALIDA del agregado Producto. El dominio/casos de uso solo conocen
 * esta interfaz; SQLite, SQL Server o MongoDB son detalles reemplazables (DIP).
 */
export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  findByStoreAndName(storeId: string, name: string): Promise<Product | null>;
  search(criteria: ProductSearchCriteria): Promise<ProductSearchResult>;
  /** Guarda el agregado y, si cambio el precio, su historial en la misma transaccion. */
  save(product: Product, priceChange?: PriceChange): Promise<void>;
  findPriceHistory(productId: string): Promise<PriceChange[]>;
  findReviews(productId: string, limit?: number): Promise<ProductReview[]>;
}
