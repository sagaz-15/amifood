# AmiFood - Módulo de Consulta de Productos (RF04)

API REST del módulo de productos de **AmiFood**, la plataforma de consulta de locales y precios de la Universidad Católica Luis Amigó. El backend fue reestructurado con **arquitectura Hexagonal (puertos y adaptadores)**, dominio independiente de Express y de la base de datos, reglas de negocio explícitas y documentación OpenAPI.

| | |
|---|---|
| **Módulo** | Consulta de productos (RF04.01 a RF04.15) |
| **Patrón arquitectónico** | Hexagonal / Ports & Adapters |
| **Stack** | Node.js 24 + TypeScript + Express 5 + SQLite + Zod + JWT + Swagger |
| **Persistencia** | SQLite (relacional, embebida, sin instalación) |
| **Documentación API** | Swagger UI en `http://localhost:3000/docs` |
| **Pruebas** | 15 pruebas unitarias con `node:test` |

## 1. Requisitos previos

- **Node.js >= 22.18** (probado con Node 24.20). Se usa la ejecución nativa de TypeScript de Node, sin paso de compilación.
- **npm >= 10**.
- No se requiere instalar SQL Server ni ningún motor de base de datos: SQLite se crea automáticamente en `server/data/amifood.db`.

## 2. Instalación y ejecución

```bash
# 1. Clonar el repositorio
git clone <https://github.com/sagaz-15/amifood.git>
cd amifood/server

# 2. Instalar dependencias
npm install

# 3. Configuración (opcional, hay valores por defecto para desarrollo)
#    En Windows: copy ..\.env.example .env
#    En Linux/macOS: cp ../.env.example .env

# 4. Crear la base y cargar los datos de demostración
npm run seed

# 5. Iniciar el servidor
npm start
```

Si la base está vacía, `npm start` también ejecuta el seed automáticamente (`SEED_ON_START=true`).

Para reiniciar los datos de demostración:

```bash
npm run seed:reset
```

### URLs

| Recurso | URL |
|---|---|
| API | `http://localhost:3000/api/v1` |
| Swagger UI | `http://localhost:3000/docs` |
| Especificación OpenAPI | `http://localhost:3000/docs/openapi.yaml` |
| Health check | `http://localhost:3000/api/health` |
| Frontend existente | `http://localhost:3000/index.html` |

### Credenciales de demostración

| Rol | Correo | Contraseña | Alcance |
|---|---|---|---|
| ADMIN | `admin@amifood.com` | `Admin123*` | Todos los locales |
| ENCARGADO | `lafrutera@amifood.com` | `AmiFood123*` | La Frutera |
| ENCARGADO | `deliu@amifood.com` | `AmiFood123*` | Deli U |
| ENCARGADO | `frailes@amifood.com` | `AmiFood123*` | Café los Frailes |
| ENCARGADO | `altoque@amifood.com` | `AmiFood123*` | Al Toque |
| ENCARGADO | `sandwich@amifood.com` | `AmiFood123*` | Sandwich Special |

## 3. Endpoints

Base: `/api/v1`. Los endpoints marcados con 🔒 requieren `Authorization: Bearer <token>`.

| Método | Ruta | Descripción | Códigos |
|---|---|---|---|
| POST | `/auth/login` | Login, devuelve JWT | 200, 400, 401 |
| GET | `/auth/me` 🔒 | Perfil de la cuenta autenticada | 200, 401 |
| GET | `/products` | Catálogo con filtros, orden y paginación | 200, 400, 404 |
| GET | `/products/:id` | Detalle + local + valoraciones | 200, 400, 404 |
| GET | `/products/mine` 🔒 | Productos del local del encargado | 200, 401, 403 |
| POST | `/products` 🔒 | Crear producto | 201, 400, 401, 403, 404, 409 |
| PUT | `/products/:id` 🔒 | Actualizar producto (datos/precio) | 200, 400, 401, 403, 404, 409 |
| PATCH | `/products/:id/availability` 🔒 | Activar/desactivar disponibilidad | 200, 400, 401, 403, 404, 409 |
| PATCH | `/products/:id/price` 🔒 | Actualizar precio con auditoría | 200, 400, 401, 403, 404 |
| POST | `/products/:id/stock-adjustments` 🔒 | Vender o reponer stock | 200, 400, 401, 403, 404, 409 |
| GET | `/products/:id/price-history` 🔒 | Historial de precios | 200, 401, 403, 404 |
| DELETE | `/products/:id` 🔒 | Borrado lógico | 204, 401, 403, 404, 409 |
| GET | `/products/events` | Stream SSE de cambios en tiempo real | 200 |

### Ejemplo rápido

```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"lafrutera@amifood.com","password":"AmiFood123*"}'

# Catálogo: hasta $8.000, disponibles, bebidas, ordenado por precio
curl "http://localhost:3000/api/v1/products?maxPrice=8000&available=true&category=BEBIDAS&sortBy=price&sortOrder=asc&page=1&pageSize=10"

# Crear (reemplace TOKEN)
curl -X POST http://localhost:3000/api/v1/products \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Arepa con queso","category":"COMIDAS_RAPIDAS","price":6500,"stock":12}'
```

En Swagger: abra `/docs`, ejecute `POST /auth/login`, copie el `token` y use el botón **Authorize** para probar los endpoints protegidos.

## 4. Reglas de negocio

El detalle completo, con trazabilidad a RF04 y pruebas, está en [`docs/REGLAS_NEGOCIO.md`](docs/REGLAS_NEGOCIO.md). Resumen:

| ID | Regla | Respuesta |
|---|---|---|
| RN-01 | Precio > 0, máximo $1.000.000 COP y 2 decimales | 400 |
| RN-02 | No se puede vender más stock del disponible | 409 `INSUFFICIENT_STOCK` |
| RN-03 | Un producto con stock 0 no puede marcarse disponible | 409 `PRODUCT_OUT_OF_STOCK` |
| RN-04 | Nombre único por local (sin distinguir mayúsculas) | 409 `PRODUCT_NAME_DUPLICATED` |
| RN-05 | El encargado solo gestiona productos de su local; el admin, todos | 403 `PRODUCT_FORBIDDEN` |
| RN-06 | Cambio de precio > 20% exige motivo y todo cambio queda auditado | 400 `PRICE_CHANGE_REASON_REQUIRED` |
| RN-07 | No se elimina un producto con ventas; se desactiva (borrado lógico) | 409 `PRODUCT_HAS_SALES` |
| RN-08 | Imagen genérica si el producto no tiene imagen | 200 con placeholder |
| RN-09 | Paginación entre 1 y 50 elementos; filtros combinados con AND | 400 |
| RN-10 | Solo se exponen productos activos de locales activos | — |

## 5. Pruebas y verificación

```bash
cd server
npm test        # 15 pruebas unitarias de reglas de negocio y autenticación
npm run typecheck
```

Las pruebas cubren: creación válida, duplicados, stock insuficiente, agotado, activación sin stock, regla del 20% de precio, auditoría, autorización por local, borrado lógico y filtros combinados.

## 6. Estructura del proyecto

```text
amifood/
├── data/productos.csv              # Catálogo base usado por el seed
├── docs/
│   ├── ARQUITECTURA.md             # Justificación, diagramas, SOLID, patrones, RNF
│   ├── REGLAS_NEGOCIO.md           # Reglas RN-01..RN-10 y trazabilidad RF04
│   └── openapi.yaml                # Especificación OpenAPI 3.0.3
├── public/                         # Frontend existente (adaptado a /api/v1)
└── server/
    ├── src/
    │   ├── domain/                 # Entidades, value objects, reglas, errores, eventos
    │   ├── application/            # Puertos (in/out), DTOs y casos de uso
    │   ├── infrastructure/
    │   │   └── adapters/
    │   │       ├── in/http/        # Controladores, rutas, validación, Swagger, SSE
    │   │       └── out/            # SQLite, JWT, bcrypt, bus de eventos
    │   ├── composition-root.ts     # Inyección de dependencias
    │   └── main.ts                 # Arranque del servidor
    ├── tests/                      # Pruebas unitarias
    └── package.json
```

La explicación de cada carpeta y su relación con los puertos/adaptadores está en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## 7. Decisiones técnicas

- **SQLite en lugar de SQL Server:** elimina la instalación y configuración de un motor para la demostración, cumple el requisito de persistencia relacional y permite que cualquier integrante o el docente ejecute el proyecto con `npm install && npm start`. Gracias a la arquitectura hexagonal, migrar a SQL Server solo requiere un nuevo adaptador que implemente `ProductRepository`; el dominio y los casos de uso no cambian.
- **TypeScript ejecutado directamente por Node:** Node 24 elimina los tipos al vuelo, así que no hay build ni carpeta `dist` que desincronice el código.
- **JWT + bcrypt:** las contraseñas se almacenan con hash bcrypt y los endpoints de escritura se protegen con token Bearer. El token incluye rol y local; además se valida que la cuenta siga activa en cada petición.
- **Swagger UI + OpenAPI 3.0.3:** documentación interactiva con ejemplos de petición y respuesta, códigos de error y esquema de seguridad.

## 8. Documentación

- [Documento de arquitectura](docs/ARQUITECTURA.md)
- [Reglas de negocio](docs/REGLAS_NEGOCIO.md)
- [OpenAPI / Swagger](docs/openapi.yaml)
- Swagger UI local: `http://localhost:3000/docs`

## 9. Equipo

- Santiago Machado Viloria
- Juan Manuel Restrepo Castro
- Sergio Pérez Mercado

Universidad Católica Luis Amigó — Proyecto de aula.
