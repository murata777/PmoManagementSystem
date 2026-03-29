const pool = require('../database');
const { sendActivityNotificationEmail } = require('../mailer');

function parseDetail(detail) {
  if (detail == null) return null;
  if (typeof detail === 'object') return detail;
  if (typeof detail === 'string') {
    try {
      return JSON.parse(detail);
    } catch {
      return null;
    }
  }
  return null;
}

/** 操作に紐づくプロジェクトID（通知のプロジェクト絞り込み用） */
function activityProjectId(targetType, targetId, detail) {
  const d = parseDetail(detail);
  if (d?.project_id) return String(d.project_id);
  if (targetType === 'project' && targetId) return String(targetId);
  return null;
}

function asStringArray(jsonbVal) {
  if (Array.isArray(jsonbVal)) return jsonbVal.map((x) => String(x));
  if (typeof jsonbVal === 'string') {
    try {
      const p = JSON.parse(jsonbVal);
      return Array.isArray(p) ? p.map((x) => String(x)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * 操作履歴INSERT後に非同期でメール通知（失敗はログのみ）
 */
async function notifyActivityEmailAfterLog({
  logId,
  userId,
  action,
  targetType,
  targetId,
  summary,
  detail,
  createdAt,
}) {
  try {
    const { rows: configs } = await pool.query(
      'SELECT enabled, project_scope, project_ids, group_ids, exclude_login FROM activity_notification_configs WHERE enabled = 1'
    );
    const groupIdSet = new Set();
    const pid = activityProjectId(targetType, targetId, detail);

    for (const s of configs) {
      if (action === 'login' && Number(s.exclude_login) === 1) continue;

      const scope = s.project_scope === 'selected' ? 'selected' : 'all';
      const projectIds = asStringArray(s.project_ids);
      const groupIds = asStringArray(s.group_ids);

      if (scope === 'selected') {
        if (!pid || !projectIds.includes(pid)) continue;
      }

      for (const gid of groupIds) {
        if (gid) groupIdSet.add(gid);
      }
    }

    if (groupIdSet.size === 0) return;

    const allGroupIds = [...groupIdSet];
    const { rows: users } = await pool.query(
      `SELECT DISTINCT u.email, u.name FROM users u
       INNER JOIN user_groups ug ON ug.user_id = u.id
       WHERE ug.group_id = ANY($1::text[])
         AND u.email IS NOT NULL
         AND TRIM(u.email) <> ''`,
      [allGroupIds]
    );
    const emails = [...new Set(users.map((u) => String(u.email).trim()).filter(Boolean))];
    if (!emails.length) return;

    let actorName = '—';
    if (userId) {
      const { rows: ar } = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
      actorName = ar[0]?.name || '—';
    }

    await sendActivityNotificationEmail(emails, {
      summary,
      actorName,
      createdAt,
      action,
      targetType,
      logId,
    });
  } catch (e) {
    console.error('[activity_email_notify]', e.message);
  }
}

module.exports = { notifyActivityEmailAfterLog, activityProjectId };
