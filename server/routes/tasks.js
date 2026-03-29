const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../database');
const { logActivity } = require('../utils/activityLog');
const { isUuid } = require('../middleware/validateUuidParams');
const { sendSafeServerError } = require('../utils/httpErrorResponse');

router.param('id', (req, res, next, id) => {
  if (!isUuid(id)) return res.status(400).json({ error: '無効なIDです' });
  next();
});

async function resolveProgressSource(projectId, progressRecordId, progressCommentId) {
  let recordId = progressRecordId || null;
  let commentId = progressCommentId || null;
  if (commentId) {
    const { rows } = await pool.query(
      `SELECT pc.record_id, pr.project_id
       FROM progress_comments pc
       JOIN progress_records pr ON pc.record_id = pr.id
       WHERE pc.id = $1`,
      [commentId]
    );
    if (!rows[0] || rows[0].project_id !== projectId) {
      return { error: '進捗コメントがこのプロジェクトに属しません' };
    }
    if (recordId && recordId !== rows[0].record_id) {
      return { error: '進捗記録とコメントの組み合わせが不正です' };
    }
    recordId = rows[0].record_id;
    return { recordId, commentId };
  }
  if (recordId) {
    const { rows } = await pool.query(
      `SELECT id FROM progress_records WHERE id = $1 AND project_id = $2`,
      [recordId, projectId]
    );
    if (!rows[0]) return { error: '進捗記録がこのプロジェクトに属しません' };
    return { recordId, commentId: null };
  }
  return { recordId: null, commentId: null };
}

router.get('/', async (req, res) => {
  try {
    const { project_id } = req.query;
    if (project_id != null && String(project_id).trim() !== '' && !isUuid(String(project_id).trim())) {
      return res.status(400).json({ error: '無効な project_id です' });
    }
    const { rows } = project_id
      ? await pool.query('SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at DESC', [project_id])
      : await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

router.post('/', async (req, res) => {
  const {
    project_id,
    title,
    description,
    status,
    priority,
    assignee,
    due_date,
    progress_record_id,
    progress_comment_id,
  } = req.body;
  if (!project_id || !title) return res.status(400).json({ error: 'project_id and title are required' });
  if (!isUuid(String(project_id).trim())) return res.status(400).json({ error: '無効な project_id です' });
  const id = uuidv4();
  try {
    let prId = null;
    let pcId = null;
    if (progress_record_id || progress_comment_id) {
      const resolved = await resolveProgressSource(project_id, progress_record_id, progress_comment_id);
      if (resolved.error) return res.status(400).json({ error: resolved.error });
      prId = resolved.recordId;
      pcId = resolved.commentId;
    }
    const { rows } = await pool.query(
      `INSERT INTO tasks (id, project_id, title, description, status, priority, assignee, due_date, progress_record_id, progress_comment_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        id,
        project_id,
        title,
        description,
        status || 'todo',
        priority || 'medium',
        assignee,
        due_date,
        prId,
        pcId,
      ]
    );
    await logActivity(req.user.id, {
      action: 'create',
      targetType: 'task',
      targetId: id,
      summary: `タスク「${title}」を作成しました`,
      detail: { project_id: project_id },
    });
    res.status(201).json(rows[0]);
  } catch (err) {
    sendSafeServerError(res, err);
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
    const t = rows[0];
    await logActivity(req.user.id, {
      action: 'update',
      targetType: 'task',
      targetId: t.id,
      summary: `タスク「${t.title || '（無題）'}」を更新しました`,
      detail: { project_id: t.project_id },
    });
    res.json(rows[0]);
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows: tr } = await pool.query('SELECT title, project_id FROM tasks WHERE id = $1', [req.params.id]);
    const { rowCount } = await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Task not found' });
    const t = tr[0];
    await logActivity(req.user.id, {
      action: 'delete',
      targetType: 'task',
      targetId: req.params.id,
      summary: `タスク「${t?.title || '（無題）'}」を削除しました`,
      detail: t?.project_id ? { project_id: t.project_id } : undefined,
    });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

module.exports = router;
