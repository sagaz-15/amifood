import type { Store } from '../../../domain/entities/store.ts';

/** PUERTO DE SALIDA para locales. */
export interface StoreRepository {
  findById(id: string): Promise<Store | null>;
}
