# Reglas de negocio — Módulo de Productos (RF04)

Este documento consolida las reglas que gobiernan el módulo. Distingue entre:

- **Derivadas:** ya estaban implícitas en `amifood.md` o `amifood RF04.md`.
- **Generadas:** no aparecían en los documentos y se definieron para que el módulo tenga un comportamiento consistente y verificable.

Todas están implementadas en el dominio (`server/src/domain/`) y verificadas por pruebas o por el adaptador HTTP.

---

## 1. Tabla resumen

| ID | Regla | Origen | Implementación | Respuesta | RF |
|---|---|---|---|---|---|
| **RN-01** | El precio debe ser mayor que 0, máximo $1.000.000 COP y admitir como máximo 2 decimales. | Generada | `domain/value-objects/money.ts` (`Money.fromDecimal`), `schemas/product-schemas.ts` | 400 `PRICE_INVALID` / `VALIDATION_ERROR` | RF04.08 |
| **RN-02** | No se puede vender (movimiento negativo) más stock del disponible; el stock nunca queda negativo. | Generada | `Product.applyStockMovement`, `SqliteProductRepository`, `CHECK (stock >= 0)` | 409 `INSUFFICIENT_STOCK` | RF04.07, RF04.14 |
| **RN-03** | Un producto con stock 0 no puede estar disponible; al llegar a 0 se desactiva automáticamente y no puede reactivarse hasta reponer. | Derivada (RF04.07) | `Product.withAvailability`, `Product.applyStockMovement`, `CHECK (stock > 0 OR is_available = 0)` | 409 `PRODUCT_OUT_OF_STOCK` | RF04.07 |
| **RN-04** | El nombre del producto es único por local, sin distinguir mayúsculas ni espacios repetidos, solo entre productos activos. | Generada | `ProductService.create/update`, índice único parcial `ux_products_store_name` | 409 `PRODUCT_NAME_DUPLICATED` | RF04.02, RF12 |
| **RN-05** | Un ENCARGADO solo puede crear, editar, cambiar precio/stock o eliminar productos de su local. Un ADMIN puede gestionar cualquiera. | Generada | `Product.assertCanBeManagedBy`, `canManageStore`, `resolveStoreForCreate` | 403 `PRODUCT_FORBIDDEN` / `ACCOUNT_WITHOUT_STORE` | RF12, RF13, RF15 |
| **RN-06** | Todo cambio de precio se registra en el historial. Si la variación supera el 20% (aumento o disminución), se exige un motivo. | Generada | `Product.withPrice`, `createPriceChange`, `ProductService.update/changePrice`, tabla `price_history` | 400 `PRICE_CHANGE_REASON_REQUIRED` | RF04.08, RF13 |
| **RN-07** | Un producto con ventas registradas no se elimina físicamente: se marca como `DELETED` (borrado lógico) y se desactiva. Sin ventas, también se usa borrado lógico para conservar historial. | Generada | `Product.assertCanBeDeleted`, `Product.softDelete` | 409 `PRODUCT_HAS_SALES`; 204 si se elimina | RF12, RNF09 |
| **RN-08** | Si el producto no tiene imagen, la API devuelve una imagen genérica. | Derivada (RF04.03) | `presentProduct` + `DEFAULT_PRODUCT_IMAGE` | 200 con `/img/product-placeholder.svg` | RF04.03 |
| **RN-09** | Los filtros se combinan con AND; `page >= 1`, `1 <= pageSize <= 50`; `minPrice <= maxPrice`. El orden permitido es nombre, precio, popularidad o calificación. | Derivada (RF04.06, RF04.12, RF04.15) | `listProductsQuerySchema`, `ProductService.list`, `SqliteProductRepository.search` | 400 `VALIDATION_ERROR` / `PRICE_RANGE_INVALID` / `PAGE_SIZE_INVALID` | RF04.06, RF04.12, RF04.15 |
| **RN-10** | Solo se exponen productos `ACTIVE` de locales activos. Los eliminados no aparecen en listados ni detalle. | Generada | `ProductRepository.search/findById`, join con `stores.is_active` | 404 `PRODUCT_NOT_FOUND` | RF04.01, RNF09 |

---

## 2. Detalle de cada regla

### RN-01 — Precio válido

**Enunciado:** el precio se expresa en pesos colombianos, debe ser estrictamente mayor que cero, no superar $1.000.000 y tener como máximo dos decimales.

**Por qué:** evita precios negativos, errores de digitación y problemas de redondeo. Internamente se guarda en centavos enteros (`price_cents`), lo que garantiza integridad (RNF09).

**Dónde:** `Money.fromDecimal()` valida y convierte; Zod rechaza en el borde; la base tiene `CHECK (price_cents > 0)`.

**Ejemplo inválido:** `{ "price": -500 }` → 400 con `details[0].field = "price"`.

---

### RN-02 — No vender sin stock

**Enunciado:** un movimiento de inventario negativo no puede dejar el stock por debajo de cero.

**Por qué:** es la regla no trivial central del módulo: no se puede vender un producto agotado. Además, `salesCount` se incrementa con cada venta para habilitar el orden por popularidad (RF04.06).

**Dónde:** `Product.applyStockMovement(delta)` calcula `stock + delta`; si es negativo lanza `ConflictError('INSUFFICIENT_STOCK')`. La base refuerza con `CHECK (stock >= 0)`.

**Ejemplo:** stock 2, `{ "delta": -5 }` → 409 `INSUFFICIENT_STOCK`.

---

### RN-03 — Disponibilidad coherente con el stock

**Enunciado:** `isAvailable = true` solo es válido si `stock > 0`. Cuando una venta deja el stock en 0, el producto pasa automáticamente a no disponible.

**Por qué:** RF04.07 exige mostrar disponibilidad/agotado; no tendría sentido mostrar “disponible” un producto sin unidades.

**Dónde:** `Product.withAvailability()` lanza 409 al intentar activar con stock 0; `applyStockMovement()` fuerza `false` al llegar a 0; el constructor normaliza estados inconsistentes; la base impone `CHECK (stock > 0 OR is_available = 0)`.

**Ejemplo:** producto agotado + `PATCH /availability { "isAvailable": true }` → 409 `PRODUCT_OUT_OF_STOCK`.

---

### RN-04 — Nombre único por local

**Enunciado:** no puede haber dos productos activos con el mismo nombre (ignorando mayúsculas y espacios repetidos) en el mismo local. Dos locales distintos sí pueden tener el mismo nombre.

**Por qué:** evita duplicados en el catálogo y ambigüedad para el estudiante; es una decisión de negocio no explícita en los documentos.

**Dónde:** `ProductService.create/update` consulta `findByStoreAndName`; el índice único parcial `(store_id, lower(name)) WHERE status = 'ACTIVE'` protege ante concurrencia; el repositorio traduce la violación a 409.

**Ejemplo:** “Perro caliente” y “PERRO CALIENTE” en La Frutera → 409 `PRODUCT_NAME_DUPLICATED`.

---

### RN-05 — Pertenencia y autorización

**Enunciado:** el ENCARGADO solo administra su local. El ADMIN puede administrar cualquier local y debe indicar `storeId` al crear.

**Por qué:** el proyecto define tres actores y RF12/RF13/RF15 asignan la gestión al encargado de cada local; sin esta regla cualquier cuenta podría modificar el catálogo ajeno.

**Dónde:** `canManageStore()` y `Product.assertCanBeManagedBy()`; `resolveStoreForCreate()` fuerza el local del token para el encargado.

**Ejemplo:** token de Deli U intentando editar un producto de La Frutera → 403 `PRODUCT_FORBIDDEN`.

---

### RN-06 — Auditoría y umbral del 20% en precios

**Enunciado:** todo cambio de precio se guarda en `price_history` con precio anterior, nuevo, fecha, cuenta y motivo. Si la variación absoluta supera el 20%, el motivo es obligatorio.

**Por qué:** RF04.08 exige mostrar el precio vigente y RNF09 la integridad; el umbral protege al estudiante de cambios accidentales o desproporcionados y deja trazabilidad para el administrador. Es una regla nueva, no estaba en los documentos.

**Dónde:** `Product.withPrice()` calcula `percentageDifferenceFrom`; `createPriceChange()` arma el registro; `SqliteProductRepository.save()` guarda producto e historial en una transacción.

**Ejemplo:** precio 10.000 → 13.000 (+30%) sin `reason` → 400 `PRICE_CHANGE_REASON_REQUIRED`; con `reason` → 200 y aparece en `GET /price-history`.

---

### RN-07 — Borrado lógico y conservación del historial

**Enunciado:** `DELETE` no borra la fila: cambia `status` a `DELETED`, desactiva el producto y registra `deleted_at`. Si `salesCount > 0`, la operación se rechaza con 409.

**Por qué:** eliminar un producto con ventas rompería la trazabilidad de pedidos e historial de precios (RNF09). La alternativa correcta es desactivarlo. Es una regla generada.

**Dónde:** `Product.assertCanBeDeleted()` y `Product.softDelete()`; el repositorio excluye `DELETED` en `findById` y `search`.

**Ejemplo:** producto con una venta → `DELETE` → 409 `PRODUCT_HAS_SALES`; producto sin ventas → 204 y deja de aparecer en consultas.

---

### RN-08 — Imagen genérica

**Enunciado:** si `image_url` es nulo, la respuesta usa `/img/product-placeholder.svg`.

**Por qué:** RF04.03 pide explícitamente una imagen representativa o una genérica.

**Dónde:** `presentProduct()` aplica `DEFAULT_PRODUCT_IMAGE`; el SVG está en `public/img/product-placeholder.svg`.

---

### RN-09 — Consulta, filtros y paginación

**Enunciado:**

- Todos los filtros (`storeId`, `q`, `category`, `available`, `minPrice`, `maxPrice`) se combinan con AND.
- `page >= 1`; `pageSize` entre 1 y 50 (por defecto 10).
- `minPrice <= maxPrice`.
- `sortBy` ∈ {`name`, `price`, `popularity`, `rating`}; `sortOrder` ∈ {`asc`, `desc`}.
- La búsqueda `q` es case-insensitive sobre nombre y descripción.

**Por qué:** RF04.04, RF04.05, RF04.06, RF04.12 y RF04.15 lo exigen; el límite de 50 evita respuestas gigantes y protege RNF03.

**Dónde:** `listProductsQuerySchema` (Zod) y `ProductService.list` (defensa en profundidad). El repositorio construye SQL parametrizado con `LIMIT/OFFSET` e índices.

---

### RN-10 — Visibilidad del catálogo

**Enunciado:** solo se listan productos `ACTIVE` de locales activos. Un producto eliminado responde 404 aunque su fila exista.

**Por qué:** coherencia con RN-07 y con la desactivación de locales (RF14); evita mostrar productos de locales cerrados.

**Dónde:** `search()` filtra `p.status = 'ACTIVE' AND s.is_active = 1`; `findById()` filtra `status = 'ACTIVE'`.

---

## 3. Reglas derivadas de los documentos originales

Estas ya se desprendían de `amifood.md` / `amifood RF04.md`:

| Requisito | Regla derivada | Implementación |
|---|---|---|
| RF04.03 | Imagen genérica si no hay imagen | RN-08 |
| RF04.06 | Orden por nombre, precio o popularidad | `sortBy` |
| RF04.07 | Mostrar disponibilidad/agotado | RN-03 |
| RF04.08 | Mostrar el precio vigente actualizado | `PATCH /price` + historial |
| RF04.10 | Mostrar promedio y comentarios si existen | `rating` + `reviews` |
| RF04.11 | Destacados por ventas o valoraciones | `sortBy=popularity` o `sortBy=rating` |
| RF04.12 | Paginar resultados extensos | RN-09 |
| RF04.15 | Combinar filtros | RN-09 |
| RF12/RF13/RF15 | El encargado gestiona productos, precios y disponibilidad de su local | RN-05 |

## 4. Reglas generadas (no estaban en los .md)

| Regla | Motivación |
|---|---|
| RN-01 Precio válido | Evitar datos corruptos y redondeos. |
| RN-02 No vender sin stock | Regla no trivial solicitada por la entrega. |
| RN-04 Nombre único por local | Evitar duplicados y ambigüedad. |
| RN-05 Autorización por local | Evitar que un encargado modifique el catálogo de otro. |
| RN-06 Umbral del 20% + auditoría | Proteger al usuario y dejar trazabilidad de precios. |
| RN-07 Borrado lógico | Preservar historial e integridad referencial. |
| RN-10 Visibilidad | No exponer productos eliminados ni locales inactivos. |

## 5. Fuera de alcance

Estas reglas pertenecen a otros módulos y no se implementaron aquí:

- Validar stock contra un pedido confirmado (módulo de pedidos; el endpoint de ajuste queda listo para integrarse).
- Escribir valoraciones solo después de una compra entregada (módulo de valoraciones; aquí se leen).
- Límite de productos por pedido o carrito.
- Descuentos, promociones o precios por horario.
- Notificaciones al usuario por cambio de estado de pedido (RF18).

## 6. Matriz de pruebas

| Regla | Prueba / evidencia |
|---|---|
| RN-01 | `valida rangos de precio` + validación Zod (400) |
| RN-02 | `no permite vender mas stock del disponible` |
| RN-03 | `no permite activar un producto agotado`, `una venta acumula popularidad...` |
| RN-04 | `rechaza nombre duplicado...` |
| RN-05 | `un encargado no puede gestionar productos de otro local` |
| RN-06 | `un cambio de precio mayor al 20% exige motivo`, `todo cambio de precio queda auditado...` |
| RN-07 | `no elimina un producto con ventas...` |
| RN-08 | Prueba E2E del listado (`imageUrl` siempre presente) |
| RN-09 | `traduce filtros combinados...`, `valida rangos...` |
| RN-10 | Consulta de producto eliminado → 404; listado solo activos |
