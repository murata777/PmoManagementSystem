const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../database');
const requireAdmin = require('../middleware/requireAdmin');
const { sendSafeServerError } = require('../utils/httpErrorResponse');

const MAX_TITLE = 500;
const MAX_BODY = 10000;

router.post('/', async (req, res) => {
  const titleRaw = req.body?.title;
  if (titleRaw == null || typeof titleRaw !== 'string' || !titleRaw.trim()) {
    return res.status(400).json({ error: '要望のタイトルを入力してください' });
  }
  const title = titleRaw.trim().slice(0, MAX_TITLE);
  const body =
    req.body?.body != null && typeof req.body.body === 'string'
      ? req.body.body.trim().slice(0, MAX_BODY) || null
      : null;

  try {
    const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO feature_requests (id, user_id, title, body, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, user_id, title, body, created_at`,
      [id, req.user.id, title, body]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

router.get('/', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT fr.id, fr.title, fr.body, fr.created_at,
              u.name AS user_name, u.email AS user_email
       FROM feature_requests fr
       INNER JOIN users u ON u.id = fr.user_id
       ORDER BY fr.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

module.exports = router;
