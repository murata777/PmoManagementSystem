const express = require('express');
const { v4: uuidv4 } = require('uuid');
const pool = require('../database');
const { isUuid } = require('../middleware/validateUuidParams');
const { sendSafeServerError } = require('../utils/httpErrorResponse');

const { mailConfigured } = require('../mailer');
const requireAdmin = require('../middleware/requireAdmin');
const { logActivity } = require('../utils/activityLog');

const router = express.Router();
router.param('id', (req, res, next, id) => {
  if (!isUuid(id)) return res.status(400).json({ error: '無効なIDです' });
  next();
});

router.get('/mail-status', requireAdmin, (req, res) => {
  res.json({ configured: mailConfigured() });
});

function asStringArray(val) {
  if (!Array.isArray(val)) return [];
  return val.map((x) => String(x).trim()).filter(Boolean);
}

function normalizeJsonbIdArray(val) {
  if (Array.isArray(val)) return val.map((x) => String(x));
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      return Array.isArray(p) ? p.map((x) => String(x)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapConfigRow(r) {
  return {
    id: r.id,
    name: r.name || '',
    enabled: Number(r.enabled) === 1,
    project_scope: r.project_scope === 'selected' ? 'selected' : 'all',
    project_ids: normalizeJsonbIdArray(r.project_ids),
    group_ids: normalizeJsonbIdArray(r.group_ids),
    exclude_login: Number(r.exclude_login) === 1,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function validateConfigBody(body) {
  const {
    enabled,
    project_scope,
    project_ids: bodyProjectIds,
    group_ids: bodyGroupIds,
    exclude_login,
    name,
  } = body;

  const scope = project_scope === 'selected' ? 'selected' : 'all';
  const projectIds = asStringArray(bodyProjectIds);
  const groupIds = asStringArray(bodyGroupIds);
  const label = String(name ?? '').trim() || '無題の設定';

  if (scope === 'selected' && projectIds.length === 0) {
    return { error: '「プロジェクトを選択」のときは1件以上選んでください' };
  }
  if (enabled && groupIds.length === 0) {
    return { error: '通知を有効にするには通知先グループを1件以上選んでください' };
  }

  return {
    ok: true,
    enabled: enabled ? 1 : 0,
    scope,
    projectIds,
    groupIds,
    exclude_login: exclude_login === false ? 0 : 1,
    name: label,
  };
}

router.get('/activity-notifications', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, enabled, project_scope, project_ids, group_ids, exclude_login, created_at, updated_at
       FROM activity_notification_configs
       ORDER BY created_at ASC`
    );
    res.json(rows.map(mapConfigRow));
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

router.post('/activity-notifications', requireAdmin, async (req, res) => {
  try {
    const v = validateConfigBody(req.body);
    if (v.error) return res.status(400).json({ error: v.error });

    const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO activity_notification_configs
        (id, name, enabled, project_scope, project_ids, group_ids, exclude_login, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, NOW(), NOW())
       RETURNING id, name, enabled, project_scope, project_ids, group_ids, exclude_login, created_at, updated_at`,
      [
        id,
        v.name,
        v.enabled,
        v.scope,
        JSON.stringify(v.projectIds),
        JSON.stringify(v.groupIds),
        v.exclude_login,
      ]
    );
    const created = mapConfigRow(rows[0]);
    await logActivity(req.user.id, {
      action: 'create',
      targetType: 'notification_config',
      targetId: id,
      summary: `通知設定「${v.name}」を追加しました`,
    });
    res.status(201).json(created);
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

router.put('/activity-notifications/:id', requireAdmin, async (req, res) => {
  try {
    const v = validateConfigBody(req.body);
    if (v.error) return res.status(400).json({ error: v.error });

    const { rows, rowCount } = await pool.query(
      `UPDATE activity_notification_configs SET
         name = $1,
         enabled = $2,
         project_scope = $3,
         project_ids = $4::jsonb,
         group_ids = $5::jsonb,
         exclude_login = $6,
         updated_at = NOW()
       WHERE id = $7
       RETURNING id, name, enabled, project_scope, project_ids, group_ids, exclude_login, created_at, updated_at`,
      [
        v.name,
        v.enabled,
        v.scope,
        JSON.stringify(v.projectIds),
        JSON.stringify(v.groupIds),
        v.exclude_login,
        req.params.id,
      ]
    );
    if (rowCount === 0) return res.status(404).json({ error: '設定が見つかりません' });
    const updated = mapConfigRow(rows[0]);
    await logActivity(req.user.id, {
      action: 'update',
      targetType: 'notification_config',
      targetId: req.params.id,
      summary: `通知設定「${v.name}」を更新しました`,
    });
    res.json(updated);
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

router.delete('/activity-notifications/:id', requireAdmin, async (req, res) => {
  try {
    const { rows: dr } = await pool.query('SELECT name FROM activity_notification_configs WHERE id = $1', [
      req.params.id,
    ]);
    if (!dr[0]) return res.status(404).json({ error: '設定が見つかりません' });
    const nm = dr[0].name || req.params.id;
    const { rowCount } = await pool.query('DELETE FROM activity_notification_configs WHERE id = $1', [
      req.params.id,
    ]);
    if (rowCount === 0) return res.status(404).json({ error: '設定が見つかりません' });
    await logActivity(req.user.id, {
      action: 'delete',
      targetType: 'notification_config',
      targetId: req.params.id,
      summary: `通知設定「${nm}」を削除しました`,
    });
    res.json({ ok: true });
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

module.exports = router;
