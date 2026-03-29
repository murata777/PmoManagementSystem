const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireUuidParamsIfPresent } = require('../middleware/requireUuidParams');
const { sendSafeServerError } = require('../utils/httpErrorResponse');

router.use(requireUuidParamsIfPresent('commentId'));
const { v4: uuidv4 } = require('uuid');
const pool = require('../database');
const { validateAndNormalizeCommentInput } = require('../utils/commentPayload');
const { logActivity } = require('../utils/activityLog');

const ALLOWED_TASK_STATUS = new Set(['todo', 'inprogress', 'review', 'done']);

// GET all comments/logs for a task (chronological)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT tc.*, u.name as user_name
       FROM task_comments tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.task_id = $1
       ORDER BY tc.created_at ASC`,
      [req.params.taskId]
    );
    res.json(rows);
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

// POST add a comment and/or assignee change and/or status change（タスクの status は DB 上の現在値と new_status を比較して更新）
router.post('/', async (req, res) => {
  const { comment, new_assignee, old_assignee, new_status } = req.body;
  let commentToStore = null;
  if (comment !== undefined && comment !== null && String(comment).trim()) {
    const v = validateAndNormalizeCommentInput(String(comment));
    if (!v.ok) {
      return res.status(400).json({ error: v.error });
    }
    commentToStore = v.value;
  }
  const hasComment = Boolean(commentToStore);
  const assigneeChanged = new_assignee !== undefined && new_assignee !== old_assignee;

  if (new_status !== undefined && !ALLOWED_TASK_STATUS.has(String(new_status))) {
    return res.status(400).json({ error: '不正なステータスです' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: taskRows } = await client.query(
      'SELECT status FROM tasks WHERE id = $1 FOR UPDATE',
      [req.params.taskId]
    );
    if (!taskRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'タスクが見つかりません' });
    }
    const dbStatus = taskRows[0].status || 'todo';
    const statusDbUpdate =
      new_status !== undefined &&
      ALLOWED_TASK_STATUS.has(String(new_status)) &&
      String(new_status) !== String(dbStatus);

    if (!hasComment && !assigneeChanged && !statusDbUpdate) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'コメント・担当者変更・ステータス変更のいずれかが必要です' });
    }

    const inserted = [];

    if (hasComment) {
      const id = uuidv4();
      const { rows } = await client.query(
        `INSERT INTO task_comments (id, task_id, user_id, comment, comment_type)
         VALUES ($1,$2,$3,$4,'comment') RETURNING *`,
        [id, req.params.taskId, req.user.id, commentToStore]
      );
      inserted.push(rows[0].id);
    }

    if (assigneeChanged) {
      const id = uuidv4();
      const { rows } = await client.query(
        `INSERT INTO task_comments (id, task_id, user_id, comment, comment_type, old_assignee, new_assignee)
         VALUES ($1,$2,$3,$4,'assignee_change',$5,$6) RETURNING *`,
        [id, req.params.taskId, req.user.id, '', old_assignee || null, new_assignee || null]
      );
      inserted.push(rows[0].id);
      await client.query(
        'UPDATE tasks SET assignee=$1, updated_at=NOW() WHERE id=$2',
        [new_assignee || null, req.params.taskId]
      );
    }

    if (statusDbUpdate) {
      const id = uuidv4();
      const { rows } = await client.query(
        `INSERT INTO task_comments (id, task_id, user_id, comment, comment_type, old_status, new_status)
         VALUES ($1,$2,$3,'','status_change',$4,$5) RETURNING *`,
        [id, req.params.taskId, req.user.id, dbStatus, new_status]
      );
      inserted.push(rows[0].id);
      await client.query(
        'UPDATE tasks SET status=$1, updated_at=NOW() WHERE id=$2',
        [new_status, req.params.taskId]
      );
    }

    await client.query('COMMIT');

    const { rows: full } = await pool.query(
      `SELECT tc.*, u.name as user_name FROM task_comments tc
       JOIN users u ON tc.user_id = u.id
       WHERE tc.id = ANY($1)
       ORDER BY tc.created_at ASC`,
      [inserted]
    );
    const { rows: tr } = await pool.query('SELECT title, project_id FROM tasks WHERE id = $1', [req.params.taskId]);
    const parts = [];
    if (hasComment) parts.push('コメント');
    if (assigneeChanged) parts.push('担当者');
    if (statusDbUpdate) parts.push('ステータス');
    await logActivity(req.user.id, {
      action: 'update',
      targetType: 'task',
      targetId: req.params.taskId,
      summary: `タスク「${tr[0]?.title || '（無題）'}」の${parts.join('・')}を更新しました`,
      detail: { project_id: tr[0]?.project_id },
    });
    res.status(201).json(full);
  } catch (err) {
    await client.query('ROLLBACK');
    sendSafeServerError(res, err);
  } finally {
    client.release();
  }
});

// DELETE a comment (only by owner, only comment type)
router.delete('/:commentId', async (req, res) => {
  try {
    const { rows: tr } = await pool.query('SELECT title, project_id FROM tasks WHERE id = $1', [req.params.taskId]);
    const { rowCount } = await pool.query(
      "DELETE FROM task_comments WHERE id=$1 AND task_id=$2 AND user_id=$3 AND comment_type='comment'",
      [req.params.commentId, req.params.taskId, req.user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'コメントが見つかりません' });
    await logActivity(req.user.id, {
      action: 'delete',
      targetType: 'task_comment',
      targetId: req.params.commentId,
      summary: `タスク「${tr[0]?.title || '（無題）'}」のコメントを削除しました`,
      detail: { project_id: tr[0]?.project_id, task_id: req.params.taskId },
    });
    res.json({ message: '削除しました' });
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

module.exports = router;
