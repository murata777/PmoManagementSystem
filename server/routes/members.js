const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database');

router.get('/', (req, res) => {
  db.all('SELECT * FROM members ORDER BY name', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/', (req, res) => {
  const { name, email, role, department } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
  const id = uuidv4();
  db.run(
    'INSERT INTO members (id, name, email, role, department) VALUES (?, ?, ?, ?, ?)',
    [id, name, email, role, department],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM members WHERE id = ?', [id], (err, row) => {
        res.status(201).json(row);
      });
    }
  );
});

router.put('/:id', (req, res) => {
  const { name, email, role, department } = req.body;
  db.run(
    'UPDATE members SET name=?, email=?, role=?, department=? WHERE id=?',
    [name, email, role, department, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Member not found' });
      db.get('SELECT * FROM members WHERE id = ?', [req.params.id], (err, row) => {
        res.json(row);
      });
    }
  );
});

router.delete('/:id', (req, res) => {
  db.run('DELETE FROM members WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Member not found' });
    res.json({ message: 'Member deleted' });
  });
});

module.exports = router;
