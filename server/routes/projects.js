const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../database');

function spiCpiFromPevAc(pv, ev, ac) {
  const n = (v) => (v !== null && v !== undefined && v !== '' ? Number(v) : null);
  const p = n(pv);
  const e = n(ev);
  const a = n(ac);
  let spi = p !== null && p !== 0 && e !== null ? e / p : null;
  let cpi = a !== null && a !== 0 && e !== null ? e / a : null;
  if (spi !== null && !Number.isFinite(spi)) spi = null;
  if (cpi !== null && !Number.isFinite(cpi)) cpi = null;
  return { spi, cpi };
}

/** LATERAL 付き SELECT の1行から evm_* 生値を除き、API 用に整形 */
function attachLatestEvm(row) {
  if (!row) return row;
  const {
    evm_pv: evmPv,
    evm_ev: evmEv,
    evm_ac: evmAc,
    evm_record_date: evmAsOf,
    ...rest
  } = row;
  const { spi, cpi } = spiCpiFromPevAc(evmPv, evmEv, evmAc);
  return {
    ...rest,
    evm_spi: spi,
    evm_cpi: cpi,
    evm_as_of: evmAsOf || null,
  };
}

const projectWithEvmSql = `
  SELECT p.*, g.name AS group_name,
    lr.record_date AS evm_record_date,
    lr.pv AS evm_pv,
    lr.ev AS evm_ev,
    lr.ac AS evm_ac
  FROM projects p
  LEFT JOIN groups g ON p.group_id = g.id
  LEFT JOIN LATERAL (
    SELECT record_date, pv, ev, ac
    FROM progress_records
    WHERE project_id = p.id
    ORDER BY record_date DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC
    LIMIT 1
  ) lr ON true
`;

// ユーザーがアクセス可能なプロジェクトかチェック
async function canAccess(userId, projectId) {
  const { rows } = await pool.query(`
    SELECT p.id FROM projects p
    WHERE p.id = $1
      AND (
        p.group_id IS NULL
        OR EXISTS (
          SELECT 1 FROM user_groups ug
          WHERE ug.group_id = p.group_id AND ug.user_id = $2
        )
      )
  `, [projectId, userId]);
  return rows.length > 0;
}

// GET all accessible projects
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `${projectWithEvmSql}
      WHERE p.group_id IS NULL
        OR EXISTS (
          SELECT 1 FROM user_groups ug
          WHERE ug.group_id = p.group_id AND ug.user_id = $1
        )
      ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json(rows.map(attachLatestEvm));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single project with tasks
router.get('/:id', async (req, res) => {
  try {
    if (!(await canAccess(req.user.id, req.params.id))) {
      return res.status(403).json({ error: 'アクセス権限がありません' });
    }
    const { rows } = await pool.query(`${projectWithEvmSql} WHERE p.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Project not found' });
    const tasks = await pool.query('SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at DESC', [req.params.id]);
    res.json({ ...attachLatestEvm(rows[0]), tasks: tasks.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create project
router.post('/', async (req, res) => {
  const { name, description, status, priority, start_date, end_date, manager, group_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const id = uuidv4();
  try {
    await pool.query(
      `INSERT INTO projects (id, name, description, status, priority, start_date, end_date, progress, manager, group_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9)`,
      [id, name, description, status || 'planning', priority || 'medium', start_date, end_date, manager, group_id || null]
    );
    const { rows } = await pool.query(`${projectWithEvmSql} WHERE p.id = $1`, [id]);
    res.status(201).json(attachLatestEvm(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST duplicate project（タスク・フェーズゲート・進捗記録は複製しない。カスタム項目は複製）
router.post('/:id/duplicate', async (req, res) => {
  const sourceId = req.params.id;
  if (!(await canAccess(req.user.id, sourceId))) {
    return res.status(403).json({ error: 'アクセス権限がありません' });
  }
  const nameOverride = req.body?.name != null ? String(req.body.name).trim() : '';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: srcRows } = await client.query('SELECT * FROM projects WHERE id = $1', [sourceId]);
    if (!srcRows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'プロジェクトが見つかりません' });
    }
    const src = srcRows[0];
    const newId = uuidv4();
    const newName = nameOverride || `${src.name}（コピー）`;

    await client.query(
      `INSERT INTO projects (id, name, description, status, priority, start_date, end_date, progress, manager, group_id, process_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10)`,
      [
        newId,
        newName,
        src.description,
        src.status,
        src.priority,
        src.start_date,
        src.end_date,
        src.manager,
        src.group_id,
        src.process_type || 'development',
      ]
    );

    const { rows: fieldRows } = await client.query(
      `SELECT field_key, field_type, field_value, sort_order
       FROM project_custom_fields WHERE project_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [sourceId]
    );
    for (const f of fieldRows) {
      const fid = uuidv4();
      await client.query(
        `INSERT INTO project_custom_fields (id, project_id, field_key, field_type, field_value, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [fid, newId, f.field_key, f.field_type || 'text', f.field_value, f.sort_order ?? 0]
      );
    }

    await client.query('COMMIT');
    const { rows } = await pool.query(`${projectWithEvmSql} WHERE p.id = $1`, [newId]);
    res.status(201).json(attachLatestEvm(rows[0]));
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (_) { /* noop */ }
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT update project（body に含まれる項目のみ上書き。進捗％は EVM 由来のため更新しない）
router.put('/:id', async (req, res) => {
  if (!(await canAccess(req.user.id, req.params.id))) {
    return res.status(403).json({ error: 'アクセス権限がありません' });
  }
  try {
    const { rows: curRows } = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (!curRows[0]) return res.status(404).json({ error: 'Project not found' });
    const cur = curRows[0];
    const b = req.body;
    const name = b.name !== undefined ? b.name : cur.name;
    const description = b.description !== undefined ? b.description : cur.description;
    const status = b.status !== undefined ? b.status : cur.status;
    const priority = b.priority !== undefined ? b.priority : cur.priority;
    const start_date = b.start_date !== undefined ? b.start_date : cur.start_date;
    const end_date = b.end_date !== undefined ? b.end_date : cur.end_date;
    const manager = b.manager !== undefined ? b.manager : cur.manager;
    const group_id = b.group_id !== undefined ? (b.group_id || null) : cur.group_id;
    const process_type = b.process_type !== undefined ? b.process_type : cur.process_type;

    await pool.query(
      `UPDATE projects SET name=$1, description=$2, status=$3, priority=$4,
       start_date=$5, end_date=$6, manager=$7, group_id=$8, process_type=$9, updated_at=NOW()
       WHERE id=$10`,
      [name, description, status, priority, start_date, end_date, manager, group_id, process_type, req.params.id]
    );
    const { rows } = await pool.query(`${projectWithEvmSql} WHERE p.id = $1`, [req.params.id]);
    res.json(attachLatestEvm(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE project
router.delete('/:id', async (req, res) => {
  if (!(await canAccess(req.user.id, req.params.id))) {
    return res.status(403).json({ error: 'アクセス権限がありません' });
  }
  try {
    await pool.query('DELETE FROM tasks WHERE project_id = $1', [req.params.id]);
    const { rowCount } = await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Project not found' });
    res.json({ message: 'Project deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
