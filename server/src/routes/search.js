const express = require('express');
const { sql, pool, poolConnect } = require('../config/database');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    await poolConnect;
    const maxPrice = parseFloat(req.query.max_price) || 0;

    const result = await pool.request()
      .input('maxPrice', sql.Decimal(10, 2), maxPrice)
      .query(`
        SELECT p.id, p.name, p.price, s.name as store, s.location
        FROM products p
        JOIN stores s ON p.store_id = s.id
        WHERE p.price <= @maxPrice AND p.is_available = 1
        ORDER BY p.price ASC
      `);

    res.json(result.recordset);
  } catch (err) {
    console.error('Error en search:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
