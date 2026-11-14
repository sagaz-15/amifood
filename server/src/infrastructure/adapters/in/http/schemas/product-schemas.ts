import { z } from 'zod';
import { PRODUCT_CATEGORIES } from '../../../../../domain/entities/product.ts';

const imageUrlSchema = z
  .string()
  .trim()
  .max(500, 'La URL de la imagen no puede superar 500 caracteres.')
  .refine(
    (value) => value.length === 0 || /^(https?:\/\/|\/)/i.test(value),
    'La imagen debe ser una URL http(s) o una ruta absoluta del sitio.',
  )
  .nullish();

const priceSchema = z
  .number({ error: 'El precio debe ser numerico.' })
  .positive('El precio debe ser mayor que cero.')
  .max(1_000_000, 'El precio no puede superar $1.000.000 COP.')
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
    'El precio admite como maximo dos decimales.',
  );

const nameSchema = z
  .string()
  .trim()
  .min(2, 'El nombre debe tener al menos 2 caracteres.')
  .max(120, 'El nombre no puede superar 120 caracteres.');

const descriptionSchema = z
  .string()
  .trim()
  .max(500, 'La descripcion no puede superar 500 caracteres.')
  .nullish();

const stockSchema = z
  .number({ error: 'El stock debe ser numerico.' })
  .int('El stock debe ser un entero.')
  .min(0, 'El stock no puede ser negativo.')
  .max(10_000, 'El stock no puede superar 10.000 unidades.');

const lowStockThresholdSchema = z
  .number({ error: 'El umbral debe ser numerico.' })
  .int('El umbral debe ser un entero.')
  .min(0, 'El umbral no puede ser negativo.')
  .max(10_000, 'El umbral no puede superar 10.000.');

export const productIdParamsSchema = z.object({
  id: z.uuid('El identificador debe ser un UUID valido.'),
});

const booleanQuerySchema = z
  .enum(['true', 'false'], { error: 'El valor debe ser true o false.' })
  .transform((value) => value === 'true');

export const listProductsQuerySchema = z.object({
  storeId: z.uuid('storeId debe ser un UUID valido.').optional(),
  q: z.string().trim().min(1, 'La busqueda no puede estar vacia.').max(100).optional(),
  category: z.enum(PRODUCT_CATEGORIES).optional(),
  available: booleanQuerySchema.optional(),
  minPrice: z.coerce.number().min(0, 'minPrice no puede ser negativo.').max(1_000_000).optional(),
  maxPrice: z.coerce.number().min(0, 'maxPrice no puede ser negativo.').max(1_000_000).optional(),
  sortBy: z.enum(['name', 'price', 'popularity', 'rating']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1, 'La pagina debe ser mayor o igual a 1.').default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1, 'pageSize debe ser mayor o igual a 1.')
    .max(50, 'pageSize no puede superar 50.')
    .default(10),
});

export const createProductSchema = z.object({
  storeId: z.uuid('storeId debe ser un UUID valido.').optional(),
  name: nameSchema,
  description: descriptionSchema,
  category: z.enum(PRODUCT_CATEGORIES),
  price: priceSchema,
  stock: stockSchema.default(0),
  lowStockThreshold: lowStockThresholdSchema.default(0),
  imageUrl: imageUrlSchema,
  isAvailable: z.boolean().optional(),
});

export const updateProductSchema = z
  .object({
    name: nameSchema.optional(),
    description: descriptionSchema,
    category: z.enum(PRODUCT_CATEGORIES).optional(),
    price: priceSchema.optional(),
    reason: z
      .string()
      .trim()
      .max(300, 'El motivo no puede superar 300 caracteres.')
      .nullish(),
    imageUrl: imageUrlSchema,
    lowStockThreshold: lowStockThresholdSchema.optional(),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    'Debe enviar al menos un campo para actualizar.',
  );

export const updateAvailabilitySchema = z.object({
  isAvailable: z.boolean({ error: 'isAvailable debe ser booleano.' }),
});

export const updatePriceSchema = z.object({
  price: priceSchema,
  reason: z
    .string()
    .trim()
    .max(300, 'El motivo no puede superar 300 caracteres.')
    .nullish(),
});

export const adjustStockSchema = z.object({
  delta: z
    .number({ error: 'delta debe ser numerico.' })
    .int('delta debe ser un entero.')
    .refine((value) => value !== 0, 'delta debe ser distinto de cero.')
    .refine((value) => Math.abs(value) <= 10_000, 'delta no puede superar 10.000 unidades.'),
  reason: z
    .string()
    .trim()
    .max(300, 'El motivo no puede superar 300 caracteres.')
    .nullish(),
});
