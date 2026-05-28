CREATE DATABASE amifood_db;
GO

USE amifood_db;
GO

CREATE TABLE stores (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    email NVARCHAR(255) NOT NULL UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    description NVARCHAR(500),
    location NVARCHAR(200),
    image_url NVARCHAR(500),
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);

CREATE TABLE products (
    id INT IDENTITY(1,1) PRIMARY KEY,
    store_id INT NOT NULL,
    name NVARCHAR(200) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    description NVARCHAR(500),
    is_available BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_products_available ON products(is_available);
GO
