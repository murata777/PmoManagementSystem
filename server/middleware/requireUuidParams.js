const { isUuid } = require('./validateUuidParams');

/** req.params の指定キーについて、値があるときだけ UUID 形式か検証 */
function requireUuidParamsIfPresent(...paramNames) {
  return (req, res, next) => {
    for (const name of paramNames) {
      const v = req.params[name];
      if (v !== undefined && v !== '' && !isUuid(v)) {
        return res.status(400).json({ error: '無効なIDです' });
      }
    }
    next();
  };
}

function requireProjectIdParam(req, res, next) {
  const v = req.params.projectId;
  if (!v || !isUuid(v)) return res.status(400).json({ error: '無効なIDです' });
  next();
}

function requireTaskIdParam(req, res, next) {
  const v = req.params.taskId;
  if (!v || !isUuid(v)) return res.status(400).json({ error: '無効なIDです' });
  next();
}

module.exports = {
  requireUuidParamsIfPresent,
  requireProjectIdParam,
  requireTaskIdParam,
};
