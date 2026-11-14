-- Esquema relacional del modulo de productos (RF04). SQLite.
-- Se ejecuta de forma idempotente al arrancar el servidor.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS stores (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    description   TEXT,
    location      TEXT,
    image_url     TEXT,
    is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('ADMIN', 'ENCARGADO')),
    store_id      TEXT REFERENCES stores(id) ON DELETE SET NULL,
    is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at    TEXT NOT NULL,
    CHECK ((role = 'ADMIN' AND store_id IS NULL) OR (role = 'ENCARGADO' AND store_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS products (
    id                  TEXT PRIMARY KEY,
    store_id            TEXT NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
    name                TEXT NOT NULL,
    description         TEXT,
    category            TEXT NOT NULL CHECK (category IN ('COMIDAS_RAPIDAS', 'BEBIDAS', 'POSTRES', 'ALMUERZOS', 'OTROS')),
    price_cents         INTEGER NOT NULL CHECK (price_cents > 0),
    stock               INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    low_stock_threshold INTEGER NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),
    image_url           TEXT,
    is_available        INTEGER NOT NULL DEFAULT 0 CHECK (is_available IN (0, 1)),
    rating_sum          INTEGER NOT NULL DEFAULT 0 CHECK (rating_sum >= 0),
    rating_count        INTEGER NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
    sales_count         INTEGER NOT NULL DEFAULT 0 CHECK (sales_count >= 0),
    status              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DELETED')),
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    deleted_at          TEXT,
    -- Una fila agotada nunca puede figurar como disponible (RN-03).
    CHECK (stock > 0 OR is_available = 0)
);

-- RN-04: nombre unico (sin distinguir mayusculas) por local entre productos activos.
CREATE UNIQUE INDEX IF NOT EXISTS ux_products_store_name
    ON products (store_id, lower(name))
    WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS ix_products_store ON products (store_id);
CREATE INDEX IF NOT EXISTS ix_products_category ON products (category);
CREATE INDEX IF NOT EXISTS ix_products_price ON products (price_cents);
CREATE INDEX IF NOT EXISTS ix_products_available ON products (is_available);
CREATE INDEX IF NOT EXISTS ix_products_sales ON products (sales_count);
CREATE INDEX IF NOT EXISTS ix_products_status ON products (status);

CREATE TABLE IF NOT EXISTS price_history (
    id                    TEXT PRIMARY KEY,
    product_id            TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    old_price_cents       INTEGER NOT NULL CHECK (old_price_cents > 0),
    new_price_cents       INTEGER NOT NULL CHECK (new_price_cents > 0),
    reason                TEXT,
    changed_by_account_id TEXT NOT NULL,
    changed_by_name       TEXT NOT NULL,
    changed_at            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_price_history_product
    ON price_history (product_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS product_ratings (
    id          TEXT PRIMARY KEY,
    product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    score       INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
    comment     TEXT,
    created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_ratings_product
    ON product_ratings (product_id, created_at DESC);
