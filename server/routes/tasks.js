const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../database');

router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    const { rows } = project_id
      ? await pool.query('SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at DESC', [project_id])
      : await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { project_id, title, description, status, priority, assignee, due_date } = req.body;
  if (!project_id || !title) return res.status(400).json({ error: 'project_id and title are required' });
  const id = uuidv4();
  try {
    const { rows } = await pool.query(
      `INSERT INTO tasks (id, project_id, title, description, status, priority, assignee, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [id, project_id, title, description, status || 'todo', priority || 'medium', assignee, due_date]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { title, description, status, priority, assignee, due_date } = req.body;
  try {
    const { rows, rowCount } = await pool.query(
      `UPDATE tasks SET title=$1, description=$2, status=$3, priority=$4,
       assignee=$5, due_date=$6, updated_at=NOW() WHERE id=$7 RETURNING *`,
      [title, description, status, priority, assignee, due_date, req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Task not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
