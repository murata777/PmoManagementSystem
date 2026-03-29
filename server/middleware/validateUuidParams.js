/**
 * アプリのリソース ID は UUID。明らかに不正なパスを 400 で弾く（多層防御）。
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Express の req.params のうち、指定名が存在し UUID でなければ 400。
 * @param {string[]} names - 例: ['id'], ['projectId','taskId']
 */
function validateUuidParams(...names) {
  return (req, res, next) => {
    for (const name of names) {
      const v = req.params[name];
      if (v !== undefined && v !== '' && !isUuid(v)) {
        return res.status(400).json({ error: '無効なIDです' });
      }
    }
    next();
  };
}

module.exports = { validateUuidParams, isUuid };
