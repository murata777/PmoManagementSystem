const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../database');

// GET all groups with member count
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT g.*, COUNT(ug.user_id)::int AS member_count
      FROM groups g
      LEFT JOIN user_groups ug ON g.id = ug.group_id
      GROUP BY g.id ORDER BY g.name
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(201).json({ ...rows[0], member_count: 0 });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'このグループ名は既に使用されています' });
    res.status(500).json({ error: err.message });
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
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'このグループ名は既に使用されています' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE group
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM groups WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'グループが見つかりません' });
    res.json({ message: 'グループを削除しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.json({ message: 'メンバーを追加しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE remove member from group
router.delete('/:id/members/:userId', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM user_groups WHERE group_id = $1 AND user_id = $2',
      [req.params.id, req.params.userId]
    );
    res.json({ message: 'メンバーを削除しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
