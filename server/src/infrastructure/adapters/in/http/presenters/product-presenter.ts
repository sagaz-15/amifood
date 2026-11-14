import type { Product } from '../../../../../domain/entities/product.ts';
import type { PriceChange } from '../../../../../domain/entities/price-change.ts';
import type { ProductReview } from '../../../../../domain/entities/product-review.ts';
import type { Store } from '../../../../../domain/entities/store.ts';
import type { Account } from '../../../../../domain/entities/account.ts';
import type { AuthProfile } from '../../../../../application/dto/auth-dto.ts';
import type { ProductDetail, ProductListItem } from '../../../../../application/dto/product-dto.ts';

/** RN-08 / RF04.03: imagen generica cuando el producto no tiene una. */
export const DEFAULT_PRODUCT_IMAGE = '/img/product-placeholder.svg';

export function presentStore(store: Store) {
  return {
    id: store.id,
    name: store.name,
    description: store.description,
    location: store.location,
    imageUrl: store.imageUrl,
    isActive: store.isActive,
  };
}

export function presentProduct(product: Product, storeName: string | null = null) {
  return {
    id: product.id,
    storeId: product.storeId,
    storeName,
    name: product.name,
    description: product.description,
    category: product.category,
    price: product.price.toDecimal(),
    currency: 'COP',
    stock: product.stock,
    lowStockThreshold: product.lowStockThreshold,
    isLowStock: product.isLowStock,
    isAvailable: product.isAvailable,
    imageUrl: product.imageUrl ?? DEFAULT_PRODUCT_IMAGE,
    rating: {
      average: product.ratingAverage,
      count: product.ratingCount,
    },
    salesCount: product.salesCount,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export function presentProductListItem(item: ProductListItem) {
  return presentProduct(item.product, item.storeName);
}

export function presentReview(review: ProductReview) {
  return {
    id: review.id,
    authorName: review.authorName,
    score: review.score,
    comment: review.comment,
    createdAt: review.createdAt,
  };
}

export function presentProductDetail(detail: ProductDetail) {
  return {
    ...presentProduct(detail.product, detail.store?.name ?? null),
    store: detail.store ? presentStore(detail.store) : null,
    reviews: detail.reviews.map(presentReview),
  };
}

export function presentPriceChange(change: PriceChange) {
  return {
    id: change.id,
    productId: change.productId,
    oldPrice: change.oldPriceCents / 100,
    newPrice: change.newPriceCents / 100,
    reason: change.reason,
    changedBy: {
      accountId: change.changedByAccountId,
      name: change.changedByName,
    },
    changedAt: change.changedAt,
  };
}

export function presentAccount(account: Account) {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    storeId: account.storeId,
  };
}

export function presentAuthProfile(profile: AuthProfile) {
  return {
    account: presentAccount(profile.account),
    store: profile.store ? presentStore(profile.store) : null,
  };
}
