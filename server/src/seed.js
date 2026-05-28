const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sql, pool, poolConnect } = require('./config/database');

const storesData = [
  { name: 'La Frutera', email: 'lafrutera@amifood.com', password: 'frutera123', location: 'Bloque 5 al lado del bloque 3', image_url: 'img/frutera.jpeg' },
  { name: 'Deli U', email: 'deliu@amifood.com', password: 'deli123', location: 'Bloque 1', image_url: 'img/deli u.jpg' },
  { name: 'Café los Frailes', email: 'frailes@amifood.com', password: 'frailes123', location: 'Atras del bloque 1', image_url: 'img/frailes.jpg' },
  { name: 'Al Toque', email: 'altoque@amifood.com', password: 'altoque123', location: 'Bloque 1 piso 5', image_url: 'img/al toque.jpg' },
  { name: 'Sandwich Special', email: 'sandwich@amifood.com', password: 'sandwich123', location: 'Bloque 2 al lado de la biblioteca', image_url: 'img/sandwichd.jpeg' }
];

const storeNameMap = {
  'la frutera': 'La Frutera',
  'deli u': 'Deli U',
  'café los frailes': 'Café los Frailes',
  'cafe los frailes': 'Café los Frailes',
  'al toque': 'Al Toque',
  'al toque ': 'Al Toque',
  'sandwich special': 'Sandwich Special',
  'sandwich special ': 'Sandwich Special'
};

async function seed() {
  try {
    await poolConnect;
    console.log('Conectado a SQL Server. Iniciando seed...');

    const storeIdMap = {};

    for (const s of storesData) {
      const hash = await bcrypt.hash(s.password, 10);

      const existing = await pool.request()
        .input('email', sql.NVarChar(255), s.email)
        .query('SELECT id, name FROM stores WHERE email = @email');

      if (existing.recordset.length > 0) {
        storeIdMap[s.name.toLowerCase()] = existing.recordset[0].id;
        console.log(`Tienda ya existe: ${s.name} (ID: ${existing.recordset[0].id})`);
        continue;
      }

      const result = await pool.request()
        .input('name', sql.NVarChar(100), s.name)
        .input('email', sql.NVarChar(255), s.email)
        .input('password', sql.NVarChar(255), hash)
        .input('location', sql.NVarChar(200), s.location)
        .input('imageUrl', sql.NVarChar(500), s.image_url)
        .query(`
          INSERT INTO stores (name, email, password_hash, location, image_url)
          OUTPUT INSERTED.id
          VALUES (@name, @email, @password, @location, @imageUrl)
        `);

      storeIdMap[s.name.toLowerCase()] = result.recordset[0].id;
      console.log(`Tienda creada: ${s.name} (ID: ${result.recordset[0].id})`);
    }

    const csvPath = path.join(__dirname, '..', '..', 'data', 'productos.csv');
    if (!fs.existsSync(csvPath)) {
      console.log('No se encontró data/productos.csv. Seed de productos omitido.');
      process.exit(0);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(l => l.trim());
    let inserted = 0;
    let skipped = 0;

    for (const line of lines) {
      const parts = line.split(';');
      if (parts.length < 3) continue;

      const productName = parts[0].trim();
      const price = parseFloat(parts[1].trim());
      const storeName = parts[2].trim().toLowerCase();

      const normalizedStore = storeNameMap[storeName]?.toLowerCase() || storeName;
      const storeId = storeIdMap[normalizedStore];

      if (!storeId) {
        console.log(`Tienda no encontrada para: ${parts[2].trim()} (normalizado: ${normalizedStore})`);
        skipped++;
        continue;
      }

      try {
        await pool.request()
          .input('storeId', sql.Int, storeId)
          .input('name', sql.NVarChar(200), productName)
          .input('price', sql.Decimal(10, 2), price)
          .query(`
            IF NOT EXISTS (SELECT 1 FROM products WHERE name = @name AND store_id = @storeId)
              INSERT INTO products (store_id, name, price) VALUES (@storeId, @name, @price)
          `);
        inserted++;
      } catch (err) {
        console.log(`Error insertando producto "${productName}": ${err.message}`);
        skipped++;
      }
    }

    console.log(`\nSeed completado!`);
    console.log(`Productos insertados: ${inserted}`);
    console.log(`Productos omitidos: ${skipped}`);

    console.log('\n--- CREDENCIALES DE TIENDAS ---');
    for (const s of storesData) {
      console.log(`  ${s.name}: ${s.email} / ${s.password}`);
    }
    console.log('-------------------------------\n');

    process.exit(0);
  } catch (err) {
    console.error('Error en seed:', err);
    process.exit(1);
  }
}

seed();
