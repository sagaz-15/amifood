import type { Product, ProductCategory } from '../../domain/entities/product.ts';
import type { ProductReview } from '../../domain/entities/product-review.ts';
import type { Store } from '../../domain/entities/store.ts';

export type ProductSortField = 'name' | 'price' | 'popularity' | 'rating';
export type SortDirection = 'asc' | 'desc';

/** Filtros combinables de la consulta (RF04.04, RF04.05, RF04.06, RF04.15). */
export interface ListProductsQuery {
  storeId?: string;
  q?: string;
  category?: ProductCategory;
  available?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: ProductSortField;
  sortOrder?: SortDirection;
  page?: number;
  pageSize?: number;
}

export interface ProductListItem {
  product: Product;
  storeName: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Detalle enriquecido con local y valoraciones (RF04.02 y RF04.10). */
export interface ProductDetail {
  product: Product;
  store: Store | null;
  reviews: ProductReview[];
}

export interface CreateProductCommand {
  /** Obligatorio solo para ADMIN; el ENCARGADO siempre crea en su propio local. */
  storeId?: string;
  name: string;
  description?: string | null;
  category: ProductCategory;
  price: number;
  stock?: number;
  lowStockThreshold?: number;
  imageUrl?: string | null;
  isAvailable?: boolean;
}

export interface UpdateProductCommand {
  name?: string;
  description?: string | null;
  category?: ProductCategory;
  price?: number;
  reason?: string | null;
  imageUrl?: string | null;
  lowStockThreshold?: number;
}
