const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

// GET all projects
router.get('/', (req, res) => {
  db.all('SELECT * FROM projects ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET single project with tasks
router.get('/:id', (req, res) => {
  db.get('SELECT * FROM projects WHERE id = ?', [req.params.id], (err, project) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    db.all('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC', [req.params.id], (err, tasks) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...project, tasks });
    });
  });
});

// POST create project
router.post('/', (req, res) => {
  const { name, description, status, priority, start_date, end_date, progress, manager } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const id = uuidv4();
  db.run(
    `INSERT INTO projects (id, name, description, status, priority, start_date, end_date, progress, manager)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, name, description, status || 'planning', priority || 'medium', start_date, end_date, progress || 0, manager],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM projects WHERE id = ?', [id], (err, row) => {
        res.status(201).json(row);
      });
    }
  );
});

// PUT update project
router.put('/:id', (req, res) => {
  const { name, description, status, priority, start_date, end_date, progress, manager } = req.body;
  db.run(
    `UPDATE projects SET name=?, description=?, status=?, priority=?, start_date=?, end_date=?, progress=?, manager=?, updated_at=datetime('now')
     WHERE id=?`,
    [name, description, status, priority, start_date, end_date, progress, manager, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Project not found' });
      db.get('SELECT * FROM projects WHERE id = ?', [req.params.id], (err, row) => {
        res.json(row);
      });
    }
  );
});

// DELETE project
router.delete('/:id', (req, res) => {
  db.run('DELETE FROM tasks WHERE project_id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run('DELETE FROM projects WHERE id = ?', [req.params.id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Project not found' });
      res.json({ message: 'Project deleted' });
    });
  });
});

module.exports = router;
