require('dotenv').config();
const express = require('express');
const router = express.Router();
const { isUuid } = require('../middleware/validateUuidParams');
const { sendSafeServerError } = require('../utils/httpErrorResponse');

router.param('id', (req, res, next, id) => {
  if (!isUuid(id)) return res.status(400).json({ error: '無効なIDです' });
  next();
});
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const pool = require('../database');
const { sendInitialPassword } = require('../mailer');
const { logActivity } = require('../utils/activityLog');

async function userIsAdmin(req) {
  const { rows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
  return rows[0] && Number(rows[0].is_admin) === 1;
}

function generateTempPassword(length = 10) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, department, is_temp_password, is_admin, created_at FROM users ORDER BY name'
    );
    res.json(rows);
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

router.post('/', async (req, res) => {
  const { name, email, role, department, is_admin: bodyIsAdmin } = req.body;
  if (!name || !email) return res.status(400).json({ error: '名前とメールアドレスは必須です' });

  try {
    let isAdminInsert = 0;
    if (bodyIsAdmin === true || bodyIsAdmin === 1) {
      if (!(await userIsAdmin(req))) return res.status(403).json({ error: '管理者権限が必要です' });
      isAdminInsert = 1;
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows[0]) return res.status(409).json({ error: 'このメールアドレスは既に登録されています' });

    const tempPassword = generateTempPassword();
    const hash = await bcrypt.hash(tempPassword, 10);
    const id = uuidv4();

    const { rows } = await pool.query(
      `INSERT INTO users (id, name, email, password_hash, is_temp_password, role, department, is_admin)
       VALUES ($1,$2,$3,$4,1,$5,$6,$7)
       RETURNING id, name, email, role, department, is_temp_password, is_admin, created_at`,
      [id, name, email, hash, role || null, department || null, isAdminInsert]
    );

    try {
      await sendInitialPassword(email, name, tempPassword);
    } catch (mailErr) {
      console.error('Mail error:', mailErr.message);
    }

    await logActivity(req.user.id, {
      action: 'create',
      targetType: 'member',
      targetId: id,
      summary: `メンバー「${name}」を追加しました`,
    });
    res.status(201).json({ ...rows[0], tempPassword });
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

router.put('/:id', async (req, res) => {
  const { name, email, role, department, is_admin: bodyIsAdmin } = req.body;
  if (!name || !email) return res.status(400).json({ error: '名前とメールアドレスは必須です' });

  try {
    const { rows: exRows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.params.id]);
    if (!exRows[0]) return res.status(404).json({ error: 'メンバーが見つかりません' });

    let nextIsAdmin = Number(exRows[0].is_admin) === 1 ? 1 : 0;
    if (bodyIsAdmin !== undefined && bodyIsAdmin !== null) {
      if (!(await userIsAdmin(req))) return res.status(403).json({ error: '管理者権限が必要です' });
      nextIsAdmin = bodyIsAdmin === true || bodyIsAdmin === 1 ? 1 : 0;
    }

    if (Number(exRows[0].is_admin) === 1 && nextIsAdmin === 0) {
      const { rows: ac } = await pool.query('SELECT COUNT(*)::int AS c FROM users WHERE is_admin = 1');
      if (ac[0].c <= 1) {
        return res.status(400).json({ error: '最後の管理者権限は外せません' });
      }
    }

    const { rows, rowCount } = await pool.query(
      `UPDATE users SET name=$1, email=$2, role=$3, department=$4, is_admin=$5, updated_at=NOW()
       WHERE id=$6
       RETURNING id, name, email, role, department, is_temp_password, is_admin, created_at`,
      [name, email, role || null, department || null, nextIsAdmin, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'メンバーが見つかりません' });
    res.json(rows[0]);
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

router.delete('/:id', async (req, res) => {
  if (req.user && req.params.id === req.user.id) {
    return res.status(400).json({ error: '自分自身のアカウントは削除できません' });
  }
  try {
    const { rows: du } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.params.id]);
    if (du[0] && Number(du[0].is_admin) === 1) {
      const { rows: ac } = await pool.query('SELECT COUNT(*)::int AS c FROM users WHERE is_admin = 1');
      if (ac[0].c <= 1) {
        return res.status(400).json({ error: '最後の管理者は削除できません' });
      }
    }

    const { rows: ur } = await pool.query('SELECT name FROM users WHERE id = $1', [req.params.id]);
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'メンバーが見つかりません' });
    await logActivity(req.user.id, {
      action: 'delete',
      targetType: 'member',
      targetId: req.params.id,
      summary: `メンバー「${ur[0]?.name || req.params.id}」を削除しました`,
    });
    res.json({ message: 'メンバーを削除しました' });
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

module.exports = router;
