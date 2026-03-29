const express = require('express');
const router = express.Router();
const { isUuid } = require('../middleware/validateUuidParams');
const { sendSafeServerError } = require('../utils/httpErrorResponse');

router.param('id', (req, res, next, id) => {
  if (!isUuid(id)) return res.status(400).json({ error: '無効なIDです' });
  next();
});
router.param('userId', (req, res, next, userId) => {
  if (!isUuid(userId)) return res.status(400).json({ error: '無効なIDです' });
  next();
});
const { v4: uuidv4 } = require('uuid');
const pool = require('../database');
const { logActivity } = require('../utils/activityLog');

// GET all groups with member count
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT g.id, g.name, g.description, g.created_at,
             COALESCE(m.cnt, 0)::int AS member_count
      FROM groups g
      LEFT JOIN (
        SELECT group_id, COUNT(*)::int AS cnt
        FROM user_groups
        GROUP BY group_id
      ) m ON m.group_id = g.id
      ORDER BY g.name
    `);
    res.json(rows);
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

// GET single group with members
router.get('/:id', async (req, res) => {
  try {
    const group = await pool.query('SELECT * FROM groups WHERE id = $1', [req.params.id]);
    if (!group.rows[0]) return res.status(404).json({ error: 'グループが見つかりません' });
    const members = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, u.department
      FROM users u
      JOIN user_groups ug ON u.id = ug.user_id
      WHERE ug.group_id = $1 ORDER BY u.name
    `, [req.params.id]);
    res.json({ ...group.rows[0], members: members.rows });
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

// POST create group
router.post('/', async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'グループ名は必須です' });
  const id = uuidv4();
  try {
    const { rows } = await pool.query(
      'INSERT INTO groups (id, name, description) VALUES ($1,$2,$3) RETURNING *',
      [id, name, description || null]
    );
    await logActivity(req.user.id, {
      action: 'create',
      targetType: 'group',
      targetId: id,
      summary: `グループ「${name}」を作成しました`,
    });
    res.status(201).json({ ...rows[0], member_count: 0 });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'このグループ名は既に使用されています' });
    sendSafeServerError(res, err);
  }
});

// PUT update group
router.put('/:id', async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'グループ名は必須です' });
  try {
    const { rows, rowCount } = await pool.query(
      'UPDATE groups SET name=$1, description=$2 WHERE id=$3 RETURNING *',
      [name, description || null, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'グループが見つかりません' });
    await logActivity(req.user.id, {
      action: 'update',
      targetType: 'group',
      targetId: req.params.id,
      summary: `グループ「${rows[0].name}」を更新しました`,
    });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'このグループ名は既に使用されています' });
    sendSafeServerError(res, err);
  }
});

// DELETE group
router.delete('/:id', async (req, res) => {
  try {
    const { rows: gr } = await pool.query('SELECT name FROM groups WHERE id = $1', [req.params.id]);
    const { rowCount } = await pool.query('DELETE FROM groups WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'グループが見つかりません' });
    await logActivity(req.user.id, {
      action: 'delete',
      targetType: 'group',
      targetId: req.params.id,
      summary: `グループ「${gr[0]?.name || req.params.id}」を削除しました`,
    });
    res.json({ message: 'グループを削除しました' });
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

// POST add member to group
router.post('/:id/members', async (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_idは必須です' });
  try {
    await pool.query(
      'INSERT INTO user_groups (user_id, group_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [user_id, req.params.id]
    );
    const { rows: gn } = await pool.query('SELECT name FROM groups WHERE id = $1', [req.params.id]);
    const { rows: un } = await pool.query('SELECT name FROM users WHERE id = $1', [user_id]);
    await logActivity(req.user.id, {
      action: 'update',
      targetType: 'group',
      targetId: req.params.id,
      summary: `グループ「${gn[0]?.name || ''}」にメンバー「${un[0]?.name || user_id}」を追加しました`,
    });
    res.json({ message: 'メンバーを追加しました' });
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

// DELETE remove member from group
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    const { rows: gn } = await pool.query('SELECT name FROM groups WHERE id = $1', [req.params.id]);
    const { rows: un } = await pool.query('SELECT name FROM users WHERE id = $1', [req.params.userId]);
    await pool.query(
      'DELETE FROM user_groups WHERE group_id = $1 AND user_id = $2',
      [req.params.id, req.params.userId]
    );
    await logActivity(req.user.id, {
      action: 'update',
      targetType: 'group',
      targetId: req.params.id,
      summary: `グループ「${gn[0]?.name || ''}」からメンバー「${un[0]?.name || req.params.userId}」を外しました`,
    });
    res.json({ message: 'メンバーを削除しました' });
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

module.exports = router;
