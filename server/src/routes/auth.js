const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql, pool, poolConnect } = require('../db');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    await poolConnect;
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    const result = await pool.request()
      .input('email', sql.NVarChar(255), email)
      .query('SELECT id, name, email, password_hash FROM stores WHERE email = @email');

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const store = result.recordset[0];
    const valid = await bcrypt.compare(password, store.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { storeId: store.id, storeName: store.name },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      store: {
        id: store.id,
        name: store.name,
        email: store.email
      }
    });
  } catch (err) {
    console.error('Error en login:', err);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
