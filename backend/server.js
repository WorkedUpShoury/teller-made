require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');

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
      return cb(null, true); // Allow all during local dev
    },
    credentials: true,
  })
);

/* ---------------- Body parsers & Static Files ---------------- */
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Serve profile pictures

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

/* ---------------- Multer Configuration ---------------- */
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: function(req, file, cb) {
    const userId = req.user ? req.user.sub : 'temp-user';
    const uniqueSuffix = Date.now() + path.extname(file.originalname);
    cb(null, 'profile-' + userId + '-' + uniqueSuffix);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function(req, file, cb) {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('File upload only supports JPEG, JPG, and PNG'));
  }
});


/* ---------------- Postgres ---------------- */
const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'tellermade',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Samu@1234',
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
    const imgUrl = (b.imgUrl || b.img_url || '').toString().trim() || null;
    const resume = req.file || null;
    return { fullName, email, password, userType, collegeName, institutionName, experience, skills, imgUrl, resume };
}

/* ---------------- Auth Middleware ---------------- */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    req.user = payload;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};


/* ============================================================================ */
/* ---------------------------------- ROUTES ---------------------------------- */
/* ============================================================================ */

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    console.error('healthcheck error:', e);
    res.status(500).json({ ok: false, error: 'db error' });
  }
});

/* ---------------- GOOGLE LOGIN ---------------- */
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
app.post('/api/google-login', async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Google token required' });

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email;
    const fullName = payload.name;
    const imgUrl = payload.picture;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      let userRes = await client.query(`SELECT id, full_name, email, user_type, img_url, created_at FROM users WHERE lower(email)=lower($1)`, [email]);
      let user;
      if (userRes.rowCount === 0) {
        const insert = await client.query(
          `INSERT INTO users (full_name, email, user_type, img_url) VALUES ($1,$2,$3,$4) RETURNING id, full_name, email, user_type, img_url, created_at`,
          [fullName, email, 'student', imgUrl]
        );
        user = insert.rows[0];
      } else {
        user = userRes.rows[0];
        if (imgUrl && user.img_url !== imgUrl) {
          const update = await client.query(
            `UPDATE users SET img_url=$1 WHERE id=$2 RETURNING id, full_name, email, user_type, img_url, created_at`,
            [imgUrl, user.id]
          );
          user = update.rows[0];
        }
      }
      await client.query('COMMIT');
      const jwtToken = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
      res.json({ user, token: jwtToken });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('google-login error:', e);
      res.status(500).json({ error: 'Server error', detail: e.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Google token verification failed:', err);
    res.status(401).json({ error: 'Invalid Google token' });
  }
});

/* ---------------- REGISTER ---------------- */
app.post('/api/register', upload.single('resume'), async (req, res) => {
  const { fullName, email, password, userType, collegeName, institutionName, experience, skills, imgUrl } = normalizeRegisterPayload(req);

  if (!fullName || !email || !password || !userType) return res.status(400).json({ error: 'Missing required fields' });
  const validTypes = new Set(['student', 'working', 'not-working']);
  if (!validTypes.has(userType)) return res.status(400).json({ error: 'Invalid userType' });
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
      `INSERT INTO users (full_name, email, password_hash, user_type, college_name, institution_name, yoe, skills, img_url) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, full_name, email, user_type, img_url, created_at`,
      [fullName, email, hash, userType, collegeName || null, institutionName || null, experience, skills, imgUrl]
    );
    await client.query('COMMIT');
    const user = insert.rows[0];
    const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
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
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const result = await pool.query(`SELECT id, full_name, email, password_hash, user_type, img_url, created_at FROM users WHERE lower(email) = lower($1)`, [email]);
    if (result.rowCount === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: '7d' });
    delete user.password_hash;
    res.json({ user, token });
  } catch (e) {
    console.error('login error:', e);
    res.status(500).json({ error: 'Server error', detail: e.message });
  }
});

/* ---------------- PROFILE UPDATE (NEW VERSION) ---------------- */
app.put('/api/me/profile', authMiddleware, upload.single('profilePic'), async (req, res) => {
  try {
    const userId = req.user.sub;
    const {
      fullName, phone, dob, gender, linkedin, portfolio, skills, userType, address,
      collegeName, degree, major, gradYear, semester, gpa,
      institutionName, title, industry, yoe, current, notice, ctc,
      lastAffiliation, highestEdu, targetRole, availability, preferredLocation
    } = req.body;

    const addressObject = JSON.parse(address || '{}');
    let updateFields = {
      full_name: fullName,
      phone: phone,
      dob: dob || null,
      gender: gender || null,
      linkedin: linkedin || null,
      portfolio: portfolio || null,
      skills: skills ? skills.split(',').map(s => s.trim()) : null,
      user_type: userType,
      address: addressObject,
    };

    if (req.file) {
      const serverBaseUrl = `${req.protocol}://${req.get('host')}`;
      updateFields.profile_pic_url = `${serverBaseUrl}/uploads/${req.file.filename}`;
    }

    if (userType === 'student') {
      Object.assign(updateFields, {
        college_name: collegeName, degree: degree, major: major, grad_year: toNumericOrNull(gradYear), semester: semester, gpa: gpa,
        institution_name: null, title: null, industry: null, yoe: null, currently_employed: null, notice: null, ctc: null,
        last_affiliation: null, highest_education: null, target_role: null, availability: null, preferred_location: null,
      });
    } else if (userType === 'working-professional') {
      Object.assign(updateFields, {
        institution_name: institutionName, title: title, industry: industry, yoe: toNumericOrNull(yoe), currently_employed: current === 'true', notice: notice, ctc: ctc,
        college_name: null, degree: null, major: null, grad_year: null, semester: null, gpa: null,
        last_affiliation: null, highest_education: null, target_role: null, availability: null, preferred_location: null,
      });
    } else if (userType === 'not-working') {
      Object.assign(updateFields, {
        last_affiliation: lastAffiliation, highest_education: highestEdu, target_role: targetRole, availability: availability, preferred_location: preferredLocation,
        college_name: null, degree: null, major: null, grad_year: null, semester: null, gpa: null,
        institution_name: null, title: null, industry: null, yoe: null, currently_employed: false, notice: null, ctc: null,
      });
    }

    const fieldNames = Object.keys(updateFields).filter(key => updateFields[key] !== undefined);
    if (fieldNames.length === 0) {
      return res.status(400).json({ error: 'No fields to update provided.' });
    }
    const setClause = fieldNames.map((field, i) => `"${field}" = $${i + 2}`).join(', ');
    const values = fieldNames.map(field => updateFields[field]);

    const result = await pool.query(`UPDATE users SET ${setClause} WHERE id = $1 RETURNING *`, [userId, ...values]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = result.rows[0];
    delete updatedUser.password_hash;
    res.json({ user: updatedUser });

  } catch (e) {
    console.error('Profile update error:', e);
    res.status(500).json({ error: 'Server error', detail: e.message });
  }
});


/* ---------------- OPTIONAL: Update avatar ---------------- */
app.put('/api/me/avatar', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { img_url } = req.body || {};
    if (!img_url) {
      return res.status(400).json({ error: 'img_url required' });
    }
    const { rows } = await pool.query(
      `UPDATE users SET img_url = $1 WHERE id = $2 RETURNING id, full_name, email, user_type, img_url, created_at`,
      [img_url, userId]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (e) {
    console.error('avatar update error:', e);
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