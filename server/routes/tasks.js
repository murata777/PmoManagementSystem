const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// GET all tasks
router.get('/', (req, res) => {
  const { project_id } = req.query;
  const query = project_id
    ? 'SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC'
    : 'SELECT * FROM tasks ORDER BY created_at DESC';
  const params = project_id ? [project_id] : [];
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST create task
router.post('/', (req, res) => {
  const { project_id, title, description, status, priority, assignee, due_date } = req.body;
  if (!project_id || !title) return res.status(400).json({ error: 'project_id and title are required' });
  const id = uuidv4();
  db.run(
    `INSERT INTO tasks (id, project_id, title, description, status, priority, assignee, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, project_id, title, description, status || 'todo', priority || 'medium', assignee, due_date],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, row) => {
        res.status(201).json(row);
      });
    }
  );
});

// PUT update task
router.put('/:id', (req, res) => {
  const { title, description, status, priority, assignee, due_date } = req.body;
  db.run(
    `UPDATE tasks SET title=?, description=?, status=?, priority=?, assignee=?, due_date=?, updated_at=datetime('now')
     WHERE id=?`,
    [title, description, status, priority, assignee, due_date, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Task not found' });
      db.get('SELECT * FROM tasks WHERE id = ?', [req.params.id], (err, row) => {
        res.json(row);
      });
    }
  );
});

// DELETE task
router.delete('/:id', (req, res) => {
  db.run('DELETE FROM tasks WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted' });
  });
});

module.exports = router;
