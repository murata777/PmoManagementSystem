const express = require('express');
const router = express.Router({ mergeParams: true });
const { v4: uuidv4 } = require('uuid');
const pool = require('../database');

async function canAccess(userId, projectId) {
  const { rows } = await pool.query(
    `SELECT p.id FROM projects p
     WHERE p.id = $1
       AND (
         p.group_id IS NULL
         OR EXISTS (
           SELECT 1 FROM user_groups ug
           WHERE ug.group_id = p.group_id AND ug.user_id = $2
         )
       )`,
    [projectId, userId]
  );
  return rows.length > 0;
}

function toNumericOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// GET / - 全進捗記録 (record_date ASC, comments含む)
router.get('/', async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!(await canAccess(req.user.id, projectId))) {
      return res.status(403).json({ error: 'アクセス権限がありません' });
    }

    const { rows: records } = await pool.query(
      `SELECT * FROM progress_records WHERE project_id = $1 ORDER BY record_date ASC`,
      [projectId]
    );

    const { rows: comments } = await pool.query(
      `SELECT pc.*, u.name as user_name
       FROM progress_comments pc
       JOIN users u ON pc.user_id = u.id
       JOIN progress_records pr ON pc.record_id = pr.id
       WHERE pr.project_id = $1
       ORDER BY pc.created_at ASC`,
      [projectId]
    );

    const commentsMap = {};
    for (const c of comments) {
      if (!commentsMap[c.record_id]) commentsMap[c.record_id] = [];
      commentsMap[c.record_id].push(c);
    }

    const result = records.map(r => ({
      ...r,
      comments: commentsMap[r.id] || [],
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - 進捗記録作成
router.post('/', async (req, res) => {
  const { projectId } = req.params;
  const { record_date, bac, pv, ev, ac, evaluation } = req.body;
  if (!record_date || !String(record_date).trim()) {
    return res.status(400).json({ error: 'record_date は必須です' });
  }
  if (!(await canAccess(req.user.id, projectId))) {
    return res.status(403).json({ error: 'アクセス権限がありません' });
  }

  try {
    const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO progress_records (id, project_id, record_date, bac, pv, ev, ac, evaluation, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, projectId, String(record_date).trim(),
        toNumericOrNull(bac),
        toNumericOrNull(pv),
        toNumericOrNull(ev),
        toNumericOrNull(ac),
        evaluation != null && String(evaluation).trim() !== '' ? String(evaluation) : null,
        req.user.id]
    );
    res.status(201).json({ ...rows[0], comments: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:recordId - 進捗記録更新
router.put('/:recordId', async (req, res) => {
  const { projectId, recordId } = req.params;
  const { record_date, bac, pv, ev, ac, evaluation } = req.body;

  try {
    if (!(await canAccess(req.user.id, projectId))) {
      return res.status(403).json({ error: 'アクセス権限がありません' });
    }
    const { rows } = await pool.query(
      `UPDATE progress_records
       SET record_date = COALESCE($1, record_date),
           bac = $2,
           pv = $3,
           ev = $4,
           ac = $5,
           evaluation = $6,
           updated_at = NOW()
       WHERE id = $7 AND project_id = $8
       RETURNING *`,
      [record_date != null && String(record_date).trim() !== '' ? String(record_date).trim() : null,
        toNumericOrNull(bac),
        toNumericOrNull(pv),
        toNumericOrNull(ev),
        toNumericOrNull(ac),
        evaluation !== undefined ? (evaluation != null && String(evaluation).trim() !== '' ? String(evaluation) : null) : null,
        recordId,
        projectId]
    );
    if (rows.length === 0) return res.status(404).json({ error: '記録が見つかりません' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:recordId - 進捗記録削除
router.delete('/:recordId', async (req, res) => {
  const { projectId, recordId } = req.params;
  try {
    if (!(await canAccess(req.user.id, projectId))) {
      return res.status(403).json({ error: 'アクセス権限がありません' });
    }
    const { rowCount } = await pool.query(
      `DELETE FROM progress_records WHERE id = $1 AND project_id = $2`,
      [recordId, projectId]
    );
    if (rowCount === 0) return res.status(404).json({ error: '記録が見つかりません' });
    res.json({ message: '削除しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:recordId/comments - コメント追加
router.post('/:recordId/comments', async (req, res) => {
  const { projectId, recordId } = req.params;
  const { comment } = req.body;
  if (!comment || !comment.trim()) {
    return res.status(400).json({ error: 'コメントを入力してください' });
  }
  try {
    if (!(await canAccess(req.user.id, projectId))) {
      return res.status(403).json({ error: 'アクセス権限がありません' });
    }
    const id = uuidv4();
    const own = await pool.query(
      `SELECT 1 FROM progress_records WHERE id = $1 AND project_id = $2`,
      [recordId, projectId]
    );
    if (own.rows.length === 0) return res.status(404).json({ error: '記録が見つかりません' });

    const { rows } = await pool.query(
      `INSERT INTO progress_comments (id, record_id, user_id, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, recordId, req.user.id, comment.trim()]
    );

    const { rows: full } = await pool.query(
      `SELECT pc.*, u.name as user_name
       FROM progress_comments pc
       JOIN users u ON pc.user_id = u.id
       WHERE pc.id = $1`,
      [rows[0].id]
    );
    res.status(201).json(full[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:recordId/comments/:commentId - 自分のコメントのみ削除
router.delete('/:recordId/comments/:commentId', async (req, res) => {
  const { projectId, recordId, commentId } = req.params;
  try {
    if (!(await canAccess(req.user.id, projectId))) {
      return res.status(403).json({ error: 'アクセス権限がありません' });
    }
    const { rowCount } = await pool.query(
      `DELETE FROM progress_comments pc
       USING progress_records pr
       WHERE pc.id = $1 AND pc.user_id = $2 AND pc.record_id = pr.id AND pr.project_id = $3 AND pr.id = $4`,
      [commentId, req.user.id, projectId, recordId]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'コメントが見つかりません' });
    res.json({ message: '削除しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
