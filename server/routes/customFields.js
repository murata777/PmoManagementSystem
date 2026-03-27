const express = require('express');
const router = express.Router({ mergeParams: true });
const { v4: uuidv4 } = require('uuid');
const pool = require('../database');

const VALID_TYPES = ['text', 'number', 'date', 'checkbox', 'link'];

// GET all custom fields for a project
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM project_custom_fields WHERE project_id = $1 ORDER BY sort_order, created_at',
      [req.params.projectId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add a custom field
router.post('/', async (req, res) => {
  const { field_key, field_type, field_value, sort_order } = req.body;
  if (!field_key) return res.status(400).json({ error: '項目名は必須です' });
  if (field_type && !VALID_TYPES.includes(field_type)) {
    return res.status(400).json({ error: '無効なタイプです' });
  }
  const id = uuidv4();
  try {
    const { rows } = await pool.query(
      `INSERT INTO project_custom_fields (id, project_id, field_key, field_type, field_value, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, req.params.projectId, field_key, field_type || 'text', field_value ?? null, sort_order ?? 0]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update a custom field
router.put('/:fieldId', async (req, res) => {
  const { field_key, field_type, field_value, sort_order } = req.body;
  if (!field_key) return res.status(400).json({ error: '項目名は必須です' });
  if (field_type && !VALID_TYPES.includes(field_type)) {
    return res.status(400).json({ error: '無効なタイプです' });
  }
  try {
    const { rows, rowCount } = await pool.query(
      `UPDATE project_custom_fields
       SET field_key=$1, field_type=$2, field_value=$3, sort_order=$4, updated_at=NOW()
       WHERE id=$5 AND project_id=$6 RETURNING *`,
      [field_key, field_type || 'text', field_value ?? null, sort_order ?? 0, req.params.fieldId, req.params.projectId]
    );
    if (rowCount === 0) return res.status(404).json({ error: '項目が見つかりません' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a custom field
router.delete('/:fieldId', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM project_custom_fields WHERE id=$1 AND project_id=$2',
      [req.params.fieldId, req.params.projectId]
    );
    if (rowCount === 0) return res.status(404).json({ error: '項目が見つかりません' });
    res.json({ message: '削除しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
