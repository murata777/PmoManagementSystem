require('dotenv').config();
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { sendInitialPassword } = require('../mailer');
const authMiddleware = require('../middleware/auth');

function generateTempPassword(length = 10) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: '名前とメールアドレスは必須です' });

  db.get('SELECT id FROM users WHERE email = ?', [email], async (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) return res.status(409).json({ error: 'このメールアドレスは既に登録されています' });

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 10);
    const id = uuidv4();

    db.run(
      'INSERT INTO users (id, name, email, password_hash, is_temp_password) VALUES (?, ?, ?, ?, 1)',
      [id, name, email, hash],
      async (err) => {
        if (err) return res.status(500).json({ error: err.message });
        try {
          await sendInitialPassword(email, name, tempPassword);
          res.status(201).json({ message: `初期パスワードを ${email} に送信しました` });
        } catch (mailErr) {
          // メール失敗時もアカウントは作成済みのため情報を返す（開発用）
          console.error('Mail error:', mailErr.message);
          res.status(201).json({
            message: 'アカウントを作成しました（メール送信に失敗しました）',
            tempPassword, // 開発環境用: 本番では削除してください
          });
        }
      }
    );
  });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'メールアドレスとパスワードは必須です' });

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
      isTempPassword: user.is_temp_password === 1,
    });
  });
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: '現在のパスワードと新しいパスワードは必須です' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'パスワードは8文字以上で入力してください' });

  db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: '現在のパスワードが正しくありません' });

    const newHash = await bcrypt.hash(newPassword, 10);
    db.run(
      "UPDATE users SET password_hash = ?, is_temp_password = 0, updated_at = datetime('now') WHERE id = ?",
      [newHash, req.user.id],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'パスワードを変更しました' });
      }
    );
  });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  db.get('SELECT id, name, email, is_temp_password FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });
    res.json({ ...user, isTempPassword: user.is_temp_password === 1 });
  });
});

module.exports = router;
