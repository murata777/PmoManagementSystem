const express = require('express');
const router = express.Router({ mergeParams: true });
const { v4: uuidv4 } = require('uuid');
const pool = require('../database');
const { validateAndNormalizeCommentInput, plainTextFromStoredComment } = require('../utils/commentPayload');
const { logActivity } = require('../utils/activityLog');

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

function normalizeProgressLinks(rawLinks) {
  let source = rawLinks;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch {
      source = [];
    }
  }
  if (!Array.isArray(source)) return [];
  const out = [];
  for (const item of source) {
    if (!item || typeof item !== 'object') continue;
    const type = item.type === 'file' ? 'file' : item.type === 'url' ? 'url' : null;
    const value = item.value != null ? String(item.value).trim() : '';
    if (!type || !value) continue;
    out.push({
      id: item.id ? String(item.id) : uuidv4(),
      type,
      value,
      label: item.label != null ? String(item.label).trim() : '',
    });
  }
  return out;
}

function withNormalizedLinks(row) {
  return { ...row, links: normalizeProgressLinks(row?.links) };
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
      links: normalizeProgressLinks(r.links),
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
  const { record_date, bac, pv, ev, ac, evaluation, links } = req.body;
  if (!record_date || !String(record_date).trim()) {
    return res.status(400).json({ error: 'record_date は必須です' });
  }
  if (!(await canAccess(req.user.id, projectId))) {
    return res.status(403).json({ error: 'アクセス権限がありません' });
  }

  try {
    const id = uuidv4();
    const normalizedLinks = normalizeProgressLinks(links);
    const { rows } = await pool.query(
      `INSERT INTO progress_records (id, project_id, record_date, bac, pv, ev, ac, evaluation, created_by, links)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       RETURNING *`,
      [id, projectId, String(record_date).trim(),
        toNumericOrNull(bac),
        toNumericOrNull(pv),
        toNumericOrNull(ev),
        toNumericOrNull(ac),
        evaluation != null && String(evaluation).trim() !== '' ? String(evaluation) : null,
        req.user.id,
        JSON.stringify(normalizedLinks)]
    );
    const { rows: pr } = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
    await logActivity(req.user.id, {
      action: 'create',
      targetType: 'progress_record',
      targetId: id,
      summary: `プロジェクト「${pr[0]?.name || ''}」に進捗記録（${String(record_date).trim()}）を追加しました`,
      detail: { project_id: projectId },
    });
    res.status(201).json({ ...withNormalizedLinks(rows[0]), comments: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:recordId - 進捗記録更新
router.put('/:recordId', async (req, res) => {
  const { projectId, recordId } = req.params;
  const { record_date, bac, pv, ev, ac, evaluation, links } = req.body;

  try {
    if (!(await canAccess(req.user.id, projectId))) {
      return res.status(403).json({ error: 'アクセス権限がありません' });
    }
    const { rows: prevRows } = await pool.query(
      'SELECT evaluation FROM progress_records WHERE id = $1 AND project_id = $2',
      [recordId, projectId]
    );
    if (!prevRows[0]) {
      return res.status(404).json({ error: '記録が見つかりません' });
    }
    const prevEval = prevRows[0].evaluation;

    const normalizedLinks = links !== undefined ? normalizeProgressLinks(links) : null;
    const evalProvided = evaluation !== undefined;
    const evalValue = evalProvided
      ? evaluation != null && String(evaluation).trim() !== ''
        ? String(evaluation)
        : null
      : null;

    const { rows } = await pool.query(
      `UPDATE progress_records
       SET record_date = COALESCE($1, record_date),
           bac = $2,
           pv = $3,
           ev = $4,
           ac = $5,
           evaluation = CASE WHEN $10::boolean THEN $6::text ELSE evaluation END,
           links = COALESCE($9::jsonb, links),
           updated_at = NOW()
       WHERE id = $7 AND project_id = $8
       RETURNING *`,
      [
        record_date != null && String(record_date).trim() !== '' ? String(record_date).trim() : null,
        toNumericOrNull(bac),
        toNumericOrNull(pv),
        toNumericOrNull(ev),
        toNumericOrNull(ac),
        evalValue,
        recordId,
        projectId,
        normalizedLinks !== null ? JSON.stringify(normalizedLinks) : null,
        evalProvided,
      ]
    );
    if (rows.length === 0) return res.status(404).json({ error: '記録が見つかりません' });

    const newEval = rows[0].evaluation;
    const evalChanged =
      evalProvided && String(prevEval ?? '') !== String(newEval ?? '');

    const { rows: pr } = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
    const projectLabel = pr[0]?.name || '';
    const dateLabel = rows[0].record_date;
    const preview =
      newEval != null && String(newEval).trim() !== ''
        ? String(newEval).replace(/\s+/g, ' ').trim().slice(0, 120)
        : '';

    await logActivity(req.user.id, {
      action: 'update',
      targetType: evalChanged ? 'progress_evaluation' : 'progress_record',
      targetId: recordId,
      summary: evalChanged
        ? `プロジェクト「${projectLabel}」の進捗（${dateLabel}）の評価コメントを保存しました`
        : `プロジェクト「${projectLabel}」の進捗記録（${dateLabel}）を更新しました`,
      detail: {
        project_id: projectId,
        ...(evalChanged && preview ? { evaluation_preview: preview } : {}),
      },
    });
    res.json(withNormalizedLinks(rows[0]));
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
    const { rows: rr } = await pool.query(
      `SELECT record_date FROM progress_records WHERE id = $1 AND project_id = $2`,
      [recordId, projectId]
    );
    const { rowCount } = await pool.query(
      `DELETE FROM progress_records WHERE id = $1 AND project_id = $2`,
      [recordId, projectId]
    );
    if (rowCount === 0) return res.status(404).json({ error: '記録が見つかりません' });
    const { rows: pr } = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
    await logActivity(req.user.id, {
      action: 'delete',
      targetType: 'progress_record',
      targetId: recordId,
      summary: `プロジェクト「${pr[0]?.name || ''}」の進捗記録（${rr[0]?.record_date || ''}）を削除しました`,
      detail: { project_id: projectId },
    });
    res.json({ message: '削除しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:recordId/duplicate — EVM（BAC/PV/EV/AC・評価コメント）のみ複製。タイムライン・タスク紐付けは含まない
router.post('/:recordId/duplicate', async (req, res) => {
  const { projectId, recordId } = req.params;
  const { record_date: bodyRecordDate } = req.body || {};
  try {
    if (!(await canAccess(req.user.id, projectId))) {
      return res.status(403).json({ error: 'アクセス権限がありません' });
    }
    const { rows } = await pool.query(
      `SELECT record_date, bac, pv, ev, ac, evaluation, links
       FROM progress_records WHERE id = $1 AND project_id = $2`,
      [recordId, projectId]
    );
    if (!rows[0]) return res.status(404).json({ error: '記録が見つかりません' });
    const src = rows[0];
    const newId = uuidv4();
    const newDate =
      bodyRecordDate != null && String(bodyRecordDate).trim() !== ''
        ? String(bodyRecordDate).trim()
        : src.record_date;
    const { rows: inserted } = await pool.query(
      `INSERT INTO progress_records (id, project_id, record_date, bac, pv, ev, ac, evaluation, created_by, links)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       RETURNING *`,
      [
        newId,
        projectId,
        newDate,
        src.bac,
        src.pv,
        src.ev,
        src.ac,
        src.evaluation,
        req.user.id,
        JSON.stringify(normalizeProgressLinks(src.links)),
      ]
    );
    const { rows: pr } = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
    await logActivity(req.user.id, {
      action: 'duplicate',
      targetType: 'progress_record',
      targetId: newId,
      summary: `プロジェクト「${pr[0]?.name || ''}」で進捗記録を複製しました（記録日 ${newDate}）`,
      detail: { project_id: projectId, source_record_id: recordId },
    });
    res.status(201).json({ ...withNormalizedLinks(inserted[0]), comments: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:recordId/comments - コメント追加
router.post('/:recordId/comments', async (req, res) => {
  const { projectId, recordId } = req.params;
  const { comment } = req.body;
  const v = validateAndNormalizeCommentInput(String(comment ?? ''));
  if (!v.ok) {
    return res.status(400).json({ error: v.error });
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
      [id, recordId, req.user.id, v.value]
    );

    const { rows: full } = await pool.query(
      `SELECT pc.*, u.name as user_name
       FROM progress_comments pc
       JOIN users u ON pc.user_id = u.id
       WHERE pc.id = $1`,
      [rows[0].id]
    );
    const { rows: pr } = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
    await logActivity(req.user.id, {
      action: 'create',
      targetType: 'progress_comment',
      targetId: full[0].id,
      summary: `プロジェクト「${pr[0]?.name || ''}」の進捗タイムラインにコメントを投稿しました`,
      detail: { project_id: projectId, record_id: recordId },
    });
    res.status(201).json(full[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /:recordId/comments/:commentId/add-task — コメントからタスクを1件だけ作成して紐付け
router.post('/:recordId/comments/:commentId/add-task', async (req, res) => {
  const { projectId, recordId, commentId } = req.params;
  const client = await pool.connect();
  try {
    if (!(await canAccess(req.user.id, projectId))) {
      return res.status(403).json({ error: 'アクセス権限がありません' });
    }
    await client.query('BEGIN');
    const { rows: pcRows } = await client.query(
      `SELECT pc.id, pc.comment, pc.linked_task_id, pr.id AS record_id
       FROM progress_comments pc
       JOIN progress_records pr ON pc.record_id = pr.id
       WHERE pc.id = $1 AND pr.id = $2 AND pr.project_id = $3`,
      [commentId, recordId, projectId]
    );
    const row = pcRows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'コメントが見つかりません' });
    }
    if (row.linked_task_id) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: '既にタスクに追加済みです', task_id: row.linked_task_id });
    }
    const title = plainTextFromStoredComment(row.comment);
    if (!title) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'コメントが空です' });
    }
    const safeTitle = title.length > 500 ? `${title.slice(0, 497)}…` : title;
    const taskId = uuidv4();
    await client.query(
      `INSERT INTO tasks (id, project_id, title, description, status, priority, progress_record_id, progress_comment_id)
       VALUES ($1, $2, $3, $4, 'todo', 'medium', $5, $6)`,
      [taskId, projectId, safeTitle, '進捗確認（EVM）／タイムラインコメントより', recordId, commentId]
    );
    await client.query(
      `UPDATE progress_comments SET linked_task_id = $1 WHERE id = $2`,
      [taskId, commentId]
    );
    await client.query('COMMIT');
    const { rows: taskRows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    const { rows: full } = await client.query(
      `SELECT pc.*, u.name as user_name
       FROM progress_comments pc
       JOIN users u ON pc.user_id = u.id
       WHERE pc.id = $1`,
      [commentId]
    );
    const { rows: pr } = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
    await logActivity(req.user.id, {
      action: 'create',
      targetType: 'task',
      targetId: taskId,
      summary: `プロジェクト「${pr[0]?.name || ''}」の進捗コメントからタスクを作成しました`,
      detail: { project_id: projectId, progress_record_id: recordId, progress_comment_id: commentId },
    });
    res.status(201).json({ task: taskRows[0], comment: full[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /:recordId/add-evaluation-task — 評価コメントからタスクを1件だけ作成して紐付け
router.post('/:recordId/add-evaluation-task', async (req, res) => {
  const { projectId, recordId } = req.params;
  const { evaluation: evaluationBody } = req.body || {};
  const client = await pool.connect();
  try {
    if (!(await canAccess(req.user.id, projectId))) {
      return res.status(403).json({ error: 'アクセス権限がありません' });
    }
    await client.query('BEGIN');
    const { rows: prRows } = await client.query(
      `SELECT id, evaluation, evaluation_linked_task_id, record_date FROM progress_records WHERE id = $1 AND project_id = $2`,
      [recordId, projectId]
    );
    const rec = prRows[0];
    if (!rec) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '記録が見つかりません' });
    }
    if (rec.evaluation_linked_task_id) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: '既にタスクに追加済みです', task_id: rec.evaluation_linked_task_id });
    }
    const fromBody = evaluationBody != null && String(evaluationBody).trim() !== '';
    const title = (fromBody ? String(evaluationBody).trim() : String(rec.evaluation || '').trim());
    if (!title) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '評価コメントを入力してください' });
    }
    const safeTitle = title.length > 500 ? `${title.slice(0, 497)}…` : title;
    const taskId = uuidv4();
    const desc = `進捗確認（EVM）／記録日 ${rec.record_date} の評価コメントより`;
    await client.query(
      `INSERT INTO tasks (id, project_id, title, description, status, priority, progress_record_id, progress_comment_id)
       VALUES ($1, $2, $3, $4, 'todo', 'medium', $5, NULL)`,
      [taskId, projectId, safeTitle, desc, recordId]
    );
    await client.query(
      `UPDATE progress_records SET evaluation_linked_task_id = $1, updated_at = NOW() WHERE id = $2`,
      [taskId, recordId]
    );
    await client.query('COMMIT');
    const { rows: taskRows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
    const { rows: recRows } = await pool.query('SELECT * FROM progress_records WHERE id = $1', [recordId]);
    const { rows: pr } = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
    await logActivity(req.user.id, {
      action: 'create',
      targetType: 'task',
      targetId: taskId,
      summary: `プロジェクト「${pr[0]?.name || ''}」の評価コメントからタスクを作成しました`,
      detail: { project_id: projectId, progress_record_id: recordId },
    });
    res.status(201).json({ task: taskRows[0], record: recRows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
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
    const { rows: pr } = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
    await logActivity(req.user.id, {
      action: 'delete',
      targetType: 'progress_comment',
      targetId: commentId,
      summary: `プロジェクト「${pr[0]?.name || ''}」の進捗タイムラインコメントを削除しました`,
      detail: { project_id: projectId, record_id: recordId },
    });
    res.json({ message: '削除しました' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
