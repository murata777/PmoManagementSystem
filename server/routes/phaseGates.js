const express = require('express');
const router = express.Router({ mergeParams: true });
const { requireUuidParamsIfPresent } = require('../middleware/requireUuidParams');
const { sendSafeServerError } = require('../utils/httpErrorResponse');

router.use(requireUuidParamsIfPresent('commentId'));
const { v4: uuidv4 } = require('uuid');
const pool = require('../database');
const { validateAndNormalizeCommentInput } = require('../utils/commentPayload');
const { logActivity } = require('../utils/activityLog');

// Helper: ensure phase_gate row exists and return its id
async function ensurePhaseGate(client, projectId, phaseKey) {
  const id = uuidv4();
  const { rows } = await client.query(
    `INSERT INTO phase_gates (id, project_id, phase_key, status)
     VALUES ($1, $2, $3, 'not_started')
     ON CONFLICT (project_id, phase_key) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [id, projectId, phaseKey]
  );
  return rows[0].id;
}

// GET / - 全フェーズゲート (metrics, comments を結合)
router.get('/', async (req, res) => {
  try {
    const { projectId } = req.params;

    const { rows: gates } = await pool.query(
      `SELECT pg.*, p.process_type
       FROM phase_gates pg
       JOIN projects p ON pg.project_id = p.id
       WHERE pg.project_id = $1
       ORDER BY pg.phase_key`,
      [projectId]
    );

    // metrics
    const { rows: metrics } = await pool.query(
      `SELECT pgm.* FROM phase_gate_metrics pgm
       JOIN phase_gates pg ON pgm.phase_gate_id = pg.id
       WHERE pg.project_id = $1`,
      [projectId]
    );

    // comments
    const { rows: comments } = await pool.query(
      `SELECT pgc.*, u.name as user_name
       FROM phase_gate_comments pgc
       JOIN phase_gates pg ON pgc.phase_gate_id = pg.id
       JOIN users u ON pgc.user_id = u.id
       WHERE pg.project_id = $1
       ORDER BY pgc.created_at ASC`,
      [projectId]
    );

    // also get process_type from project
    const { rows: projectRows } = await pool.query(
      `SELECT process_type FROM projects WHERE id = $1`,
      [projectId]
    );
    const processType = projectRows[0]?.process_type || 'development';

    // assemble
    const metricsMap = {};
    for (const m of metrics) {
      if (!metricsMap[m.phase_gate_id]) metricsMap[m.phase_gate_id] = {};
      metricsMap[m.phase_gate_id][m.metric_key] = m.value;
    }
    const commentsMap = {};
    for (const c of comments) {
      if (!commentsMap[c.phase_gate_id]) commentsMap[c.phase_gate_id] = [];
      commentsMap[c.phase_gate_id].push(c);
    }

    const result = gates.map(g => ({
      ...g,
      metrics: metricsMap[g.id] || {},
      comments: commentsMap[g.id] || [],
    }));

    res.json({ processType, gates: result });
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

// PUT /:phaseKey - ステータスをupsert
router.put('/:phaseKey', async (req, res) => {
  const { projectId, phaseKey } = req.params;
  const { status } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = uuidv4();
    const { rows } = await client.query(
      `INSERT INTO phase_gates (id, project_id, phase_key, status, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (project_id, phase_key) DO UPDATE
         SET status = EXCLUDED.status, updated_at = NOW()
       RETURNING *`,
      [id, projectId, phaseKey, status]
    );
    await client.query('COMMIT');
    const { rows: pr } = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
    await logActivity(req.user.id, {
      action: 'update',
      targetType: 'phase_gate',
      targetId: rows[0].id,
      summary: `プロジェクト「${pr[0]?.name || ''}」のフェーズ「${phaseKey}」ステータスを更新しました`,
      detail: { project_id: projectId, phase_key: phaseKey, status },
    });
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    sendSafeServerError(res, err);
  } finally {
    client.release();
  }
});

// PUT /:phaseKey/metrics - メトリクスをupsert
router.put('/:phaseKey/metrics', async (req, res) => {
  const { projectId, phaseKey } = req.params;
  const { metrics } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ensure phase_gate exists
    const pgId = await ensurePhaseGate(client, projectId, phaseKey);

    for (const [key, value] of Object.entries(metrics)) {
      const id = uuidv4();
      await client.query(
        `INSERT INTO phase_gate_metrics (id, phase_gate_id, metric_key, value, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (phase_gate_id, metric_key) DO UPDATE
           SET value = EXCLUDED.value, updated_at = NOW()`,
        [id, pgId, key, value === '' || value === null ? null : value]
      );
    }

    await client.query('COMMIT');

    // return updated metrics
    const { rows } = await pool.query(
      `SELECT metric_key, value FROM phase_gate_metrics WHERE phase_gate_id = $1`,
      [pgId]
    );
    const result = {};
    for (const r of rows) result[r.metric_key] = r.value;
    const { rows: pr } = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
    await logActivity(req.user.id, {
      action: 'update',
      targetType: 'phase_gate',
      targetId: pgId,
      summary: `プロジェクト「${pr[0]?.name || ''}」のフェーズ「${phaseKey}」指標を更新しました`,
      detail: { project_id: projectId, phase_key: phaseKey },
    });
    res.json({ metrics: result });
  } catch (err) {
    await client.query('ROLLBACK');
    sendSafeServerError(res, err);
  } finally {
    client.release();
  }
});

// POST /:phaseKey/comments - コメント追加
router.post('/:phaseKey/comments', async (req, res) => {
  const { projectId, phaseKey } = req.params;
  const { comment } = req.body;
  const v = validateAndNormalizeCommentInput(String(comment ?? ''));
  if (!v.ok) {
    return res.status(400).json({ error: v.error });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pgId = await ensurePhaseGate(client, projectId, phaseKey);

    const commentId = uuidv4();
    const { rows } = await client.query(
      `INSERT INTO phase_gate_comments (id, phase_gate_id, user_id, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [commentId, pgId, req.user.id, v.value]
    );

    await client.query('COMMIT');

    // return with user name
    const { rows: full } = await pool.query(
      `SELECT pgc.*, u.name as user_name
       FROM phase_gate_comments pgc
       JOIN users u ON pgc.user_id = u.id
       WHERE pgc.id = $1`,
      [rows[0].id]
    );
    const { rows: pr } = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
    await logActivity(req.user.id, {
      action: 'create',
      targetType: 'phase_gate_comment',
      targetId: full[0].id,
      summary: `プロジェクト「${pr[0]?.name || ''}」のフェーズ「${phaseKey}」にコメントを投稿しました`,
      detail: { project_id: projectId, phase_key: phaseKey },
    });
    res.status(201).json(full[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    sendSafeServerError(res, err);
  } finally {
    client.release();
  }
});

// DELETE /:phaseKey/comments/:commentId - コメント削除（自分のコメントのみ）
router.delete('/:phaseKey/comments/:commentId', async (req, res) => {
  const { projectId, phaseKey, commentId } = req.params;
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM phase_gate_comments WHERE id = $1 AND user_id = $2`,
      [commentId, req.user.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'コメントが見つかりません' });
    const { rows: pr } = await pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
    await logActivity(req.user.id, {
      action: 'delete',
      targetType: 'phase_gate_comment',
      targetId: commentId,
      summary: `プロジェクト「${pr[0]?.name || ''}」のフェーズ「${phaseKey}」コメントを削除しました`,
      detail: { project_id: projectId, phase_key: phaseKey },
    });
    res.json({ message: '削除しました' });
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

module.exports = router;
