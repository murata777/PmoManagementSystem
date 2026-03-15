require('dotenv').config();
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const pool = require('../database');
const { sendInitialPassword } = require('../mailer');

function generateTempPassword(length = 10) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, department, is_temp_password, created_at FROM users ORDER BY name'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, email, role, department } = req.body;
  if (!name || !email) return res.status(400).json({ error: '名前とメールアドレスは必須です' });

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows[0]) return res.status(409).json({ error: 'このメールアドレスは既に登録されています' });

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 10);
    const id = uuidv4();

    const { rows } = await pool.query(
      `INSERT INTO users (id, name, email, password_hash, is_temp_password, role, department)
       VALUES ($1,$2,$3,$4,1,$5,$6)
       RETURNING id, name, email, role, department, is_temp_password, created_at`,
      [id, name, email, hash, role || null, department || null]
    );

    try {
      await sendInitialPassword(email, name, tempPassword);
    } catch (mailErr) {
      console.error('Mail error:', mailErr.message);
    }

    res.status(201).json({ ...rows[0], tempPassword });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, email, role, department } = req.body;
  if (!name || !email) return res.status(400).json({ error: '名前とメールアドレスは必須です' });

  try {
    const { rows, rowCount } = await pool.query(
      `UPDATE users SET name=$1, email=$2, role=$3, department=$4, updated_at=NOW()
       WHERE id=$5
       RETURNING id, name, email, role, department, is_temp_password, created_at`,
      [name, email, role || null, department || null, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'メンバーが見つかりません' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  if (req.user && req.params.id === req.user.id) {
    return res.status(400).json({ error: '自分自身のアカウントは削除できません' });
  }
  try {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'メンバーが見つかりません' });
    res.json({ message: 'メンバーを削除しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
