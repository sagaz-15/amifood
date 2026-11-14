/** Valoracion visible en el detalle del producto (RF04.10). */
export interface ProductReview {
  readonly id: string;
  readonly productId: string;
  readonly authorName: string;
  readonly score: number;
  readonly comment: string | null;
  readonly createdAt: string;
}
