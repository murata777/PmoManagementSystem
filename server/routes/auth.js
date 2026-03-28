require('dotenv').config();
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../database');
const { sendInitialPassword } = require('../mailer');
const authMiddleware = require('../middleware/auth');
const { logActivity } = require('../utils/activityLog');

function generateTempPassword(length = 10) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: '名前とメールアドレスは必須です' });

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows[0]) return res.status(409).json({ error: 'このメールアドレスは既に登録されています' });

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 10);
    const id = uuidv4();

    await pool.query(
      'INSERT INTO users (id, name, email, password_hash, is_temp_password) VALUES ($1,$2,$3,$4,1)',
      [id, name, email, hash]
    );

    try {
      await sendInitialPassword(email, name, tempPassword);
      res.status(201).json({ message: `初期パスワードを ${email} に送信しました` });
    } catch (mailErr) {
      console.error('Mail error:', mailErr.message);
      res.status(201).json({
        message: 'アカウントを作成しました（メール送信に失敗しました）',
        tempPassword,
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'メールアドレスとパスワードは必須です' });

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    await logActivity(user.id, {
      action: 'login',
      targetType: 'session',
      summary: 'ログインしました',
    });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
      isTempPassword: user.is_temp_password === 1,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: '現在のパスワードと新しいパスワードは必須です' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'パスワードは8文字以上で入力してください' });

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: '現在のパスワードが正しくありません' });

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash=$1, is_temp_password=0, updated_at=NOW() WHERE id=$2',
      [newHash, req.user.id]
    );
    await logActivity(req.user.id, {
      action: 'update',
      targetType: 'account',
      targetId: req.user.id,
      summary: 'パスワードを変更しました',
    });
    res.json({ message: 'パスワードを変更しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'メールアドレスは必須です' });

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    // ユーザーが存在しない場合も同じメッセージを返す（セキュリティ対策）
    if (!user) {
      return res.json({ message: `初期パスワードを ${email} に送信しました` });
    }

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 10);

    await pool.query(
      'UPDATE users SET password_hash=$1, is_temp_password=1, updated_at=NOW() WHERE id=$2',
      [hash, user.id]
    );

    try {
      await sendInitialPassword(email, user.name, tempPassword);
      res.json({ message: `初期パスワードを ${email} に送信しました` });
    } catch (mailErr) {
      console.error('Mail error:', mailErr.message);
      res.json({
        message: 'パスワードをリセットしました（メール送信に失敗しました）',
        tempPassword, // 開発環境用
      });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, is_temp_password FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });
    res.json({ ...user, isTempPassword: user.is_temp_password === 1 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
