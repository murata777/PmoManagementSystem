const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../database');

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Project not found' });
    const tasks = await pool.query('SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at DESC', [req.params.id]);
    res.json({ ...rows[0], tasks: tasks.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, description, status, priority, start_date, end_date, progress, manager } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const id = uuidv4();
  try {
    const { rows } = await pool.query(
      `INSERT INTO projects (id, name, description, status, priority, start_date, end_date, progress, manager)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, name, description, status || 'planning', priority || 'medium', start_date, end_date, progress || 0, manager]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, description, status, priority, start_date, end_date, progress, manager } = req.body;
  try {
    const { rows, rowCount } = await pool.query(
      `UPDATE projects SET name=$1, description=$2, status=$3, priority=$4,
       start_date=$5, end_date=$6, progress=$7, manager=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [name, description, status, priority, start_date, end_date, progress, manager, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Project not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
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
