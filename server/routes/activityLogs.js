const express = require('express');
const router = express.Router();
const pool = require('../database');
const activityUserDisplayName = require('../utils/activityUserDisplayName');
const { isUuid } = require('../middleware/validateUuidParams');
const { sendSafeServerError } = require('../utils/httpErrorResponse');

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const projectId =
      req.query.project_id != null && String(req.query.project_id).trim() !== ''
        ? String(req.query.project_id).trim()
        : null;
    const userId =
      req.query.user_id != null && String(req.query.user_id).trim() !== ''
        ? String(req.query.user_id).trim()
        : null;

    if (projectId && !isUuid(projectId)) {
      return res.status(400).json({ error: '無効な project_id です' });
    }
    if (userId && !isUuid(userId)) {
      return res.status(400).json({ error: '無効な user_id です' });
    }

    const conditions = [];
    const filterParams = [];
    let p = 1;

    if (projectId) {
      conditions.push(
        `((al.detail->>'project_id') = $${p} OR (al.target_type = 'project' AND al.target_id = $${p}))`
      );
      filterParams.push(projectId);
      p += 1;
    }
    if (userId) {
      conditions.push(`al.user_id = $${p}`);
      filterParams.push(userId);
      p += 1;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitIdx = p;
    const offsetIdx = p + 1;
    const listParams = [...filterParams, limit, offset];

    const listSql = `
      SELECT al.id, al.user_id, al.action, al.target_type, al.target_id, al.summary, al.detail, al.created_at,
             (${activityUserDisplayName}) AS user_name, u.email AS user_email,
             pr.name AS project_name
      FROM activity_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN projects pr ON pr.id = COALESCE(
        NULLIF(TRIM(al.detail->>'project_id'), ''),
        CASE WHEN al.target_type = 'project' THEN NULLIF(TRIM(al.target_id), '') ELSE NULL END
      )
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`;

    const countSql =
      conditions.length > 0
        ? `SELECT COUNT(*)::int AS c FROM activity_logs al ${whereClause}`
        : 'SELECT COUNT(*)::int AS c FROM activity_logs';

    const [list, count] = await Promise.all([
      pool.query(listSql, listParams),
      pool.query(countSql, filterParams),
    ]);
    res.json({
      items: list.rows,
      total: count.rows[0]?.c ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

module.exports = router;
