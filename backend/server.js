// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const app = express();

/* ---------------- CORS ---------------- */
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(null, true); // allow all during local dev
    },
    credentials: true,
  })
);

/* ---------------- Body parsers ---------------- */
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((err, _req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body', detail: err.message });
  }
  return next(err);
});

/* ---------------- Logger ---------------- */
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url} ct=${req.headers['content-type'] || 'n/a'}`);
  next();
});

/* ---------------- Multer ---------------- */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/* ---------------- Postgres ---------------- */
const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'tellermade',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: false,
});

/* ---------------- Helpers ---------------- */
function normalizeSkills(skills) {
  if (Array.isArray(skills)) return skills.map((s) => String(s).trim()).filter(Boolean);
  if (typeof skills === 'string') return skills.split(',').map((s) => s.trim()).filter(Boolean);
  return null;
}

function toNumericOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function normalizeRegisterPayload(req) {
  const b = req.body || {};
  const fullName = (b.fullName || b.name || '').toString().trim();
  const email = (b.email || '').toString().trim();
  const password = (b.password || '').toString();

  let userType = (b.userType || b.status || '').toString().trim().toLowerCase();
  if (userType.startsWith('working')) userType = 'working';
  if (userType === 'not working' || userType === 'not-working') userType = 'not-working';
  if (userType === 'student') userType = 'student';

  const collegeName = (b.collegeName || b.college || '').toString().trim();
  const institutionName = (b.institutionName || b.company || b.institution || '').toString().trim();
  const experienceRaw = (b.experience || b.yoe || '').toString().trim();
  const experience = toNumericOrNull(experienceRaw);
  const skills = normalizeSkills(b.skills);

  const resume = req.file || null;

  return {
    fullName, email, password, userType,
    collegeName, institutionName, experience, skills, resume
  };
}

/* ---------------- Routes ---------------- */
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    console.error('healthcheck error:', e);
    res.status(500).json({ ok: false, error: 'db error' });
  }
});

app.post('/api/register', upload.single('resume'), async (req, res) => {
  const {
    fullName, email, password, userType,
    collegeName, institutionName, experience, skills
  } = normalizeRegisterPayload(req);

  if (!fullName || !email || !password || !userType) {
    return res.status(400).json({ error: 'Missing required fields', got: { fullName, email, userType } });
  }
  const validTypes = new Set(['student', 'working', 'not-working']);
  if (!validTypes.has(userType)) return res.status(400).json({ error: 'Invalid userType', got: userType });
  if (userType === 'student' && !collegeName) return res.status(400).json({ error: 'collegeName required for student' });
  if (userType === 'working' && !institutionName) return res.status(400).json({ error: 'institutionName required for working' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const dup = await client.query('SELECT 1 FROM users WHERE lower(email)=lower($1)', [email]);
    if (dup.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 12);

    const insert = await client.query(
      `INSERT INTO users
        (full_name, email, password_hash, user_type, college_name, institution_name, experience, skills)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, full_name, email, user_type, created_at`,
      [fullName, email, hash, userType, collegeName || null, institutionName || null, experience, skills]
    );

    await client.query('COMMIT');

    const user = insert.rows[0];
    const token = jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '7d' }
    );

    res.json({ user, token });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('register error:', e);
    res.status(500).json({ error: 'Server error', detail: e.message });
  } finally {
    client.release();
  }
});

/* ---------------- LOGIN ---------------- */
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await pool.query(
      `SELECT id, full_name, email, password_hash, user_type, created_at
       FROM users WHERE lower(email) = lower($1)`,
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '7d' }
    );

    delete user.password_hash; // don’t leak hash
    res.json({ user, token });
  } catch (e) {
    console.error('login error:', e);
    res.status(500).json({ error: 'Server error', detail: e.message });
  }
});


/* ---------------- Global error ---------------- */
app.use((err, _req, res, _next) => {
  console.error('unhandled error:', err);
  res.status(500).json({ error: 'Unexpected server error' });
});

/* ---------------- Start ---------------- */
const port = Number(process.env.PORT || 5001);
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
