const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../database');

// ユーザーがアクセス可能なプロジェクトかチェック
async function canAccess(userId, projectId) {
  const { rows } = await pool.query(`
    SELECT p.id FROM projects p
    WHERE p.id = $1
      AND (
        p.group_id IS NULL
        OR EXISTS (
          SELECT 1 FROM user_groups ug
          WHERE ug.group_id = p.group_id AND ug.user_id = $2
        )
      )
  `, [projectId, userId]);
  return rows.length > 0;
}

// GET all accessible projects
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.*, g.name AS group_name
      FROM projects p
      LEFT JOIN groups g ON p.group_id = g.id
      WHERE p.group_id IS NULL
        OR EXISTS (
          SELECT 1 FROM user_groups ug
          WHERE ug.group_id = p.group_id AND ug.user_id = $1
        )
      ORDER BY p.created_at DESC
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single project with tasks
router.get('/:id', async (req, res) => {
  try {
    if (!(await canAccess(req.user.id, req.params.id))) {
      return res.status(403).json({ error: 'アクセス権限がありません' });
    }
    const { rows } = await pool.query(`
      SELECT p.*, g.name AS group_name
      FROM projects p LEFT JOIN groups g ON p.group_id = g.id
      WHERE p.id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Project not found' });
    const tasks = await pool.query('SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at DESC', [req.params.id]);
    res.json({ ...rows[0], tasks: tasks.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create project
router.post('/', async (req, res) => {
  const { name, description, status, priority, start_date, end_date, progress, manager, group_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const id = uuidv4();
  try {
    const { rows } = await pool.query(
      `INSERT INTO projects (id, name, description, status, priority, start_date, end_date, progress, manager, group_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [id, name, description, status || 'planning', priority || 'medium', start_date, end_date, progress || 0, manager, group_id || null]
    );
    const result = await pool.query(`
      SELECT p.*, g.name AS group_name FROM projects p
      LEFT JOIN groups g ON p.group_id = g.id WHERE p.id = $1
    `, [id]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update project
router.put('/:id', async (req, res) => {
  if (!(await canAccess(req.user.id, req.params.id))) {
    return res.status(403).json({ error: 'アクセス権限がありません' });
  }
  const { name, description, status, priority, start_date, end_date, progress, manager, group_id } = req.body;
  try {
    const { rowCount } = await pool.query(
      `UPDATE projects SET name=$1, description=$2, status=$3, priority=$4,
       start_date=$5, end_date=$6, progress=$7, manager=$8, group_id=$9, updated_at=NOW()
       WHERE id=$10`,
      [name, description, status, priority, start_date, end_date, progress, manager, group_id || null, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Project not found' });
    const result = await pool.query(`
      SELECT p.*, g.name AS group_name FROM projects p
      LEFT JOIN groups g ON p.group_id = g.id WHERE p.id = $1
    `, [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE project
router.delete('/:id', async (req, res) => {
  if (!(await canAccess(req.user.id, req.params.id))) {
    return res.status(403).json({ error: 'アクセス権限がありません' });
  }
  try {
    await pool.query('DELETE FROM tasks WHERE project_id = $1', [req.params.id]);
    const { rowCount } = await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Project not found' });
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
