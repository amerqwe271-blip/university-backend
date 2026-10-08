const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Health Check Endpoint
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

// 1. جلب قائمة الأقسام
app.get('/api/departments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM departments ORDER BY id ASC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. جلب جميع الطلاب
app.get('/api/students', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, d.name as department_name 
      FROM students s 
      LEFT JOIN departments d ON s.department_id = d.id 
      ORDER BY s.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. إضافة طالب جديد مع فحص الرقم الأكاديمي (9 أرقام)
app.post('/api/students', async (req, res) => {
  const { student_id, name, email, department_id } = req.body;

  // التحقق من أن الرقم الأكاديمي يتكون من 9 أرقام بالضبط
  if (!student_id || !/^\d{9}$/.test(student_id)) {
    return res.status(400).json({ 
      success: false, 
      error: 'الرقم الأكاديمي يجب أن يتكون من 9 أرقام بالضبط.' 
    });
  }

  try {
    const query = `
      INSERT INTO students (student_id, name, email, department_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [student_id, name, email, department_id];
    const result = await pool.query(query, values);
    
    res.status(201).json({
      success: true,
      message: 'تم إضافة الطالب بنجاح',
      data: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});