require('dotenv').config();
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { sendInitialPassword } = require('../mailer');

function generateTempPassword(length = 10) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// GET all members (= users)
router.get('/', (req, res) => {
  db.all(
    'SELECT id, name, email, role, department, is_temp_password, created_at FROM users ORDER BY name',
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// POST create member = create user account + send initial password
router.post('/', async (req, res) => {
  const { name, email, role, department } = req.body;
  if (!name || !email) return res.status(400).json({ error: '名前とメールアドレスは必須です' });

  db.get('SELECT id FROM users WHERE email = ?', [email], async (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) return res.status(409).json({ error: 'このメールアドレスは既に登録されています' });

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 10);
    const id = uuidv4();

    db.run(
      'INSERT INTO users (id, name, email, password_hash, is_temp_password, role, department) VALUES (?, ?, ?, ?, 1, ?, ?)',
      [id, name, email, hash, role || null, department || null],
      async (err) => {
        if (err) return res.status(500).json({ error: err.message });
        try {
          await sendInitialPassword(email, name, tempPassword);
        } catch (mailErr) {
          console.error('Mail error:', mailErr.message);
        }
        db.get(
          'SELECT id, name, email, role, department, is_temp_password, created_at FROM users WHERE id = ?',
          [id],
          (err, row) => {
            res.status(201).json({ ...row, tempPassword }); // 開発用: 本番では tempPassword を除去
          }
        );
      }
    );
  });
});

// PUT update member profile (name, email, role, department)
router.put('/:id', (req, res) => {
  const { name, email, role, department } = req.body;
  if (!name || !email) return res.status(400).json({ error: '名前とメールアドレスは必須です' });

  db.run(
    "UPDATE users SET name=?, email=?, role=?, department=?, updated_at=datetime('now') WHERE id=?",
    [name, email, role || null, department || null, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'メンバーが見つかりません' });
      db.get(
        'SELECT id, name, email, role, department, is_temp_password, created_at FROM users WHERE id = ?',
        [req.params.id],
        (err, row) => res.json(row)
      );
    }
  );
});

// DELETE member = delete user account
router.delete('/:id', (req, res) => {
  // 自分自身は削除不可
  if (req.user && req.params.id === req.user.id) {
    return res.status(400).json({ error: '自分自身のアカウントは削除できません' });
  }
  db.run('DELETE FROM users WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'メンバーが見つかりません' });
    res.json({ message: 'メンバーを削除しました' });
  });
});

module.exports = router;
