const express = require('express');
const router = express.Router({ mergeParams: true });
const { v4: uuidv4 } = require('uuid');
const pool = require('../database');

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
    res.status(500).json({ error: err.message });
  }
});

// POST add a comment and/or assignee change
router.post('/', async (req, res) => {
  const { comment, new_assignee, old_assignee } = req.body;
  const hasComment = comment && comment.trim();
  const assigneeChanged = new_assignee !== undefined && new_assignee !== old_assignee;

  if (!hasComment && !assigneeChanged) {
    return res.status(400).json({ error: 'コメントまたは担当者変更が必要です' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = [];

    if (hasComment) {
      const id = uuidv4();
      const { rows } = await client.query(
        `INSERT INTO task_comments (id, task_id, user_id, comment, comment_type)
         VALUES ($1,$2,$3,$4,'comment') RETURNING *`,
        [id, req.params.taskId, req.user.id, comment.trim()]
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
      // タスクの担当者を更新
      await client.query(
        'UPDATE tasks SET assignee=$1, updated_at=NOW() WHERE id=$2',
        [new_assignee || null, req.params.taskId]
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
    res.status(201).json(full);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE a comment (only by owner, only comment type)
router.delete('/:commentId', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM task_comments WHERE id=$1 AND task_id=$2 AND user_id=$3 AND comment_type='comment'",
      [req.params.commentId, req.params.taskId, req.user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'コメントが見つかりません' });
    res.json({ message: '削除しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
