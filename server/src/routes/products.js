const express = require('express');
const { sql, pool, poolConnect } = require('../db');
const authMiddleware = require('../middleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    await poolConnect;
    const result = await pool.request()
      .input('storeId', sql.Int, req.storeId)
      .query('SELECT * FROM products WHERE store_id = @storeId ORDER BY name');
    res.json(result.recordset);
  } catch (err) {
    console.error('Error al obtener productos:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/', async (req, res) => {
  try {
    await poolConnect;
    const { name, price, description } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'Nombre y precio requeridos' });
    }

    const result = await pool.request()
      .input('storeId', sql.Int, req.storeId)
      .input('name', sql.NVarChar(200), name.trim())
      .input('price', sql.Decimal(10, 2), parseFloat(price))
      .input('description', sql.NVarChar(500), description || null)
      .query(`
        INSERT INTO products (store_id, name, price, description)
        OUTPUT INSERTED.*
        VALUES (@storeId, @name, @price, @description)
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('Error al crear producto:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    await poolConnect;
    const { name, price, description, is_available } = req.body;
    const productId = parseInt(req.params.id);

    const result = await pool.request()
      .input('id', sql.Int, productId)
      .input('storeId', sql.Int, req.storeId)
      .input('name', sql.NVarChar(200), name?.trim() || '')
      .input('price', sql.Decimal(10, 2), parseFloat(price) || 0)
      .input('description', sql.NVarChar(500), description || null)
      .input('isAvailable', sql.Bit, is_available !== undefined ? (is_available ? 1 : 0) : 1)
      .query(`
        UPDATE products
        SET name = @name, price = @price, description = @description,
            is_available = @isAvailable, updated_at = GETDATE()
        WHERE id = @id AND store_id = @storeId
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ message: 'Producto actualizado exitosamente' });
  } catch (err) {
    console.error('Error al actualizar producto:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await poolConnect;
    const productId = parseInt(req.params.id);

    const result = await pool.request()
      .input('id', sql.Int, productId)
      .input('storeId', sql.Int, req.storeId)
      .query('DELETE FROM products WHERE id = @id AND store_id = @storeId');

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ message: 'Producto eliminado exitosamente' });
  } catch (err) {
    console.error('Error al eliminar producto:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
