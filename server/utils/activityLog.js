const { v4: uuidv4 } = require('uuid');
const pool = require('../database');
const { notifyActivityEmailAfterLog } = require('./activityEmailNotify');

/**
 * 操作履歴を記録する。失敗しても API 応答には影響しない。
 * @param {string|null|undefined} userId
 * @param {{ action: string, targetType: string, targetId?: string|null, summary: string, detail?: object }} entry
 */
async function logActivity(userId, entry) {
  if (!userId || !entry?.summary) return;
  const { action, targetType, targetId, summary, detail } = entry;
  try {
    const id = uuidv4();
    const { rows } = await pool.query(
      `INSERT INTO activity_logs (id, user_id, action, target_type, target_id, summary, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at`,
      [
        id,
        userId,
        action,
        targetType,
        targetId != null && targetId !== '' ? String(targetId) : null,
        summary,
        detail != null ? JSON.stringify(detail) : null,
      ]
    );
    const row = rows[0];
    if (row) {
      setImmediate(() => {
        notifyActivityEmailAfterLog({
          logId: row.id,
          userId,
          action,
          targetType,
          targetId,
          summary,
          detail,
          createdAt: row.created_at,
        }).catch((err) => console.error('[activity_email_notify]', err?.message || err));
      });
    }
  } catch (e) {
    console.error('[activity_logs]', e.message);
  }
}

module.exports = { logActivity };
