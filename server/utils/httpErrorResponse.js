/**
 * 本番では DB・内部スタックの詳細をクライアントに返さない。
 * 開発時のみ err.message を返す。
 */
function isDev() {
  return process.env.NODE_ENV !== 'production';
}

function sendSafeServerError(res, err, logPrefix = '') {
  if (logPrefix) console.error(logPrefix, err);
  else console.error(err);
  const message = isDev() && err && err.message ? err.message : 'サーバーエラーが発生しました。';
  res.status(500).json({ error: message });
}

module.exports = { sendSafeServerError, isDev };
