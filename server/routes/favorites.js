const express = require('express');
const router = express.Router();
const { isUuid } = require('../middleware/validateUuidParams');
const { sendSafeServerError } = require('../utils/httpErrorResponse');

router.param('id', (req, res, next, id) => {
  if (!isUuid(id)) return res.status(400).json({ error: '無効なIDです' });
  next();
});
const { v4: uuidv4 } = require('uuid');
const pool = require('../database');

const MAX_PATH_LEN = 1024;
const MAX_LABEL_LEN = 200;

function validateFavoritePath(raw) {
  if (raw == null || typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t.startsWith('/') || t.startsWith('//')) return null;
  if (t.length > MAX_PATH_LEN) return null;
  const lower = t.toLowerCase();
  if (lower.includes('javascript:') || lower.includes('data:')) return null;
  return t;
}

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, path, label, sort_order, created_at
       FROM user_favorites
       WHERE user_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

router.put('/reorder', async (req, res) => {
  const order = req.body?.order;
  if (!Array.isArray(order) || order.some((id) => typeof id !== 'string')) {
    return res.status(400).json({ error: 'order は文字列 ID の配列です' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT id FROM user_favorites WHERE user_id = $1', [req.user.id]);
    const setIds = new Set(rows.map((r) => r.id));
    if (order.length !== setIds.size || !order.every((id) => setIds.has(id))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'お気に入りの並びが一致しません' });
    }
    for (let i = 0; i < order.length; i += 1) {
      await client.query('UPDATE user_favorites SET sort_order = $1 WHERE id = $2 AND user_id = $3', [
        i,
        order[i],
        req.user.id,
      ]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    sendSafeServerError(res, err);
  } finally {
    client.release();
  }
});

router.post('/', async (req, res) => {
  const path = validateFavoritePath(req.body?.path);
  if (!path) return res.status(400).json({ error: '無効なパスです' });
  let label = req.body?.label;
  if (label != null && typeof label !== 'string') label = String(label);
  label = (label || path).trim().slice(0, MAX_LABEL_LEN) || path;

  try {
    const { rows: dup } = await pool.query(
      'SELECT id FROM user_favorites WHERE user_id = $1 AND path = $2',
      [req.user.id, path]
    );
    if (dup[0]) {
      const { rows } = await pool.query('SELECT id, path, label, sort_order, created_at FROM user_favorites WHERE id = $1', [
        dup[0].id,
      ]);
      return res.status(200).json({ item: rows[0], already: true });
    }

    const { rows: maxR } = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM user_favorites WHERE user_id = $1',
      [req.user.id]
    );
    const id = uuidv4();
    const sortOrder = Number(maxR[0]?.n) || 0;
    await pool.query(
      `INSERT INTO user_favorites (id, user_id, path, label, sort_order)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, req.user.id, path, label, sortOrder]
    );
    const { rows } = await pool.query(
      'SELECT id, path, label, sort_order, created_at FROM user_favorites WHERE id = $1',
      [id]
    );
    res.status(201).json({ item: rows[0] });
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM user_favorites WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id,
    ]);
    if (rowCount === 0) return res.status(404).json({ error: '見つかりません' });
    res.json({ ok: true });
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

module.exports = router;
