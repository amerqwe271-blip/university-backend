const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// إعداد الاتصال بقاعدة البيانات Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ==========================================
// 1. الصفحة الرئيسية واختبار الاتصال (Health Check)
// ==========================================
app.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      success: true, 
      message: 'الباك إند يعمل بنجاح ومربوط بقاعدة البيانات!', 
      time: result.rows[0].now 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'حدث خطأ في الاتصال بقاعدة البيانات' });
  }
});

// ==========================================
// 2. إدارة الأقسام (Departments)
// ==========================================

// جلب جميع الأقسام
app.get('/api/departments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM departments ORDER BY id ASC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. إدارة الطلاب (Students)
// ==========================================

// جلب جميع الطلاب مع اسم القسم
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

// البحث عن طالب محدد بواسطة الرقم الأكاديمي
app.get('/api/students/:student_id', async (req, res) => {
  const { student_id } = req.params;
  try {
    const result = await pool.query(`
      SELECT s.*, d.name as department_name 
      FROM students s 
      LEFT JOIN departments d ON s.department_id = d.id 
      WHERE s.student_id = $1
    `, [student_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'الطالب غير موجود' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إضافة طالب جديد (شرط الـ 9 أرقام للرقم الأكاديمي)
app.post('/api/students', async (req, res) => {
  const { student_id, name, email, department_id } = req.body;

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

// حذف طالب بواسطة الرقم الأكاديمي
app.delete('/api/students/:student_id', async (req, res) => {
  const { student_id } = req.params;
  try {
    const result = await pool.query('DELETE FROM students WHERE student_id = $1 RETURNING *', [student_id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'الطالب غير موجود' });
    }
    res.json({ success: true, message: 'تم حذف الطالب بنجاح' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4. إدارة المواد الدراسية (Courses)
// ==========================================

// جلب جميع المواد الدراسية
app.get('/api/courses', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, d.name as department_name 
      FROM courses c 
      LEFT JOIN departments d ON c.department_id = d.id 
      ORDER BY c.id ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// إضافة مادة دراسية جديدة
app.post('/api/courses', async (req, res) => {
  const { code, name, credits, department_id } = req.body;
  try {
    const query = `
      INSERT INTO courses (code, name, credits, department_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await pool.query(query, [code, name, credits || 3, department_id]);
    res.status(201).json({ success: true, message: 'تم إضافة المادة بنجاح', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 5. إدارة تسجيل المواد والدرجات (Enrollments & Grades)
// ==========================================

// تسجيل مادة لطالب
app.post('/api/enrollments', async (req, res) => {
  const { student_id, course_id } = req.body;
  try {
    const query = `
      INSERT INTO enrollments (student_id, course_id)
      VALUES ($1, $2)
      RETURNING *
    `;
    const result = await pool.query(query, [student_id, course_id]);
    res.status(201).json({ success: true, message: 'تم تسجيل المادة للطالب بنجاح', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// عرض المواد المسجلة مع الدرجات
app.get('/api/enrollments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.id as enrollment_id, s.student_id, s.name as student_name, 
             c.code as course_code, c.name as course_name, e.grade
      FROM enrollments e
      JOIN students s ON e.student_id = s.id
      JOIN courses c ON e.course_id = c.id
      ORDER BY e.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// رصد وتحديث درجة طالب في مادة
app.put('/api/enrollments/:id/grade', async (req, res) => {
  const { id } = req.params;
  const { grade } = req.body;
  
  if (grade < 0 || grade > 100) {
    return res.status(400).json({ success: false, error: 'الدرجة يجب أن تكون بين 0 و 100' });
  }

  try {
    const result = await pool.query(
      'UPDATE enrollments SET grade = $1 WHERE id = $2 RETURNING *',
      [grade, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'سجل التسجيل غير موجود' });
    }
    res.json({ success: true, message: 'تم تحديث الدرجة بنجاح', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// تشغيل السيرفر
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});