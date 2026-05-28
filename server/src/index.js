const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { poolConnect } = require('./db');
const searchRoutes = require('./routes/search');
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '..', '..')));

app.use('/api/products/search', searchRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

poolConnect
  .then(() => {
    console.log('Conectado a SQL Server');
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
      console.log(`API de búsqueda: http://localhost:${PORT}/api/products/search?max_price=5000`);
      console.log(`API de login: http://localhost:${PORT}/api/auth/login`);
    });
  })
  .catch(err => {
    console.error('Error conectando a SQL Server:', err);
    process.exit(1);
  });
