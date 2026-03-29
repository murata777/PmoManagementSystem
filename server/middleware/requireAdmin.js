const pool = require('../database');
const { sendSafeServerError } = require('../utils/httpErrorResponse');

/** authMiddleware の後で使用。DB で is_admin を確認する */
module.exports = async function requireAdmin(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0] || Number(rows[0].is_admin) !== 1) {
      return res.status(403).json({ error: '管理者権限が必要です' });
    }
    next();
  } catch (e) {
    sendSafeServerError(res, e);
  }
};
