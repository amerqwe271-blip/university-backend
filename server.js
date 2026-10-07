const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// الاتصال بقاعدة بيانات Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// مسار اختباري (Health Check)
app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      success: true, 
      message: 'الباك إند يعمل بنجاح ومربوط بقاعدة البيانات!', 
      time: result.rows[0].now 
    });
  } catch (err) {
    console.error('Database Connection Error:', err);
    res.status(500).json({ success: false, error: 'حدث خطأ في الاتصال بقاعدة البيانات' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});