const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../database');
const { isUuid } = require('../middleware/validateUuidParams');
const { sendSafeServerError } = require('../utils/httpErrorResponse');
const { validateAndNormalizeOptionalRichNotes } = require('../utils/commentPayload');
const { logActivity } = require('../utils/activityLog');

const MAX_TITLE = 500;

function summaryTitle(t) {
  const s = String(t || '').trim();
  if (s.length <= 60) return s || '（無題）';
  return `${s.slice(0, 57)}…`;
}

function normalizeDueDate(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function mapRow(r) {
  if (!r) return r;
  return {
    ...r,
    completed: Number(r.completed) === 1,
  };
}

router.put('/reorder', async (req, res) => {
  const order = req.body?.order;
  if (!Array.isArray(order) || order.some((id) => typeof id !== 'string')) {
    return res.status(400).json({ error: 'order は文字列 ID の配列です' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT id, completed FROM user_personal_todos WHERE user_id = $1',
      [req.user.id]
    );
    const byId = new Map(rows.map((r) => [r.id, r]));
    if (order.length !== byId.size || !order.every((id) => byId.has(id))) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '並びが一致しません' });
    }
    let seenDone = false;
    for (const id of order) {
      const done = Number(byId.get(id).completed) === 1;
      if (done && !seenDone) seenDone = true;
      if (!done && seenDone) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: '未完了を完了より上に並べてください' });
      }
    }
    let si = 0;
    let sc = 0;
    for (const id of order) {
      const done = Number(byId.get(id).completed) === 1;
      const so = done ? sc : si;
      if (done) sc += 1;
      else si += 1;
      await client.query(
        'UPDATE user_personal_todos SET sort_order = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
        [so, id, req.user.id]
      );
    }
    await client.query('COMMIT');
    await logActivity(req.user.id, {
      action: 'update',
      targetType: 'personal_todo',
      targetId: null,
      summary: 'マイToDoの並び順を変更しました',
      detail: { path: '/my-todos' },
    });
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    sendSafeServerError(res, err);
  } finally {
    client.release();
  }
});

router.param('id', (req, res, next, id) => {
  if (!isUuid(id)) return res.status(400).json({ error: '無効なIDです' });
  next();
});

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, title, notes, due_date, completed, sort_order, created_at, updated_at
       FROM user_personal_todos
       WHERE user_id = $1
       ORDER BY completed ASC, sort_order ASC, created_at DESC`,
      [req.user.id]
    );
    res.json(rows.map(mapRow));
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

router.post('/', async (req, res) => {
  const titleRaw = req.body?.title;
  if (titleRaw == null || typeof titleRaw !== 'string' || !titleRaw.trim()) {
    return res.status(400).json({ error: 'タイトルは必須です' });
  }
  const title = titleRaw.trim().slice(0, MAX_TITLE);
  let notes = null;
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'notes')) {
    const n = validateAndNormalizeOptionalRichNotes(req.body.notes);
    if (!n.ok) return res.status(400).json({ error: n.error });
    if (n.value !== undefined) notes = n.value;
  }
  const due_date = normalizeDueDate(req.body?.due_date);

  try {
    const { rows: maxR } = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n
       FROM user_personal_todos
       WHERE user_id = $1 AND completed = 0`,
      [req.user.id]
    );
    const id = uuidv4();
    const sortOrder = Number(maxR[0]?.n) || 0;
    const { rows } = await pool.query(
      `INSERT INTO user_personal_todos (id, user_id, title, notes, due_date, completed, sort_order)
       VALUES ($1, $2, $3, $4, $5, 0, $6)
       RETURNING id, title, notes, due_date, completed, sort_order, created_at, updated_at`,
      [id, req.user.id, title, notes, due_date, sortOrder]
    );
    await logActivity(req.user.id, {
      action: 'create',
      targetType: 'personal_todo',
      targetId: id,
      summary: `マイToDo「${summaryTitle(title)}」を追加しました`,
      detail: { path: '/my-todos', todo_id: id },
    });
    res.status(201).json(mapRow(rows[0]));
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { rows: curRows } = await pool.query(
      'SELECT * FROM user_personal_todos WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!curRows[0]) return res.status(404).json({ error: '見つかりません' });
    const cur = curRows[0];

    let title = cur.title;
    if (req.body?.title !== undefined) {
      if (typeof req.body.title !== 'string' || !req.body.title.trim()) {
        return res.status(400).json({ error: 'タイトルは必須です' });
      }
      title = req.body.title.trim().slice(0, MAX_TITLE);
    }

    let notes = cur.notes;
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'notes')) {
      const n = validateAndNormalizeOptionalRichNotes(req.body.notes);
      if (!n.ok) return res.status(400).json({ error: n.error });
      if (n.value !== undefined) notes = n.value;
    }

    let due_date = cur.due_date;
    if (req.body?.due_date !== undefined) {
      due_date = req.body.due_date === null || req.body.due_date === '' ? null : normalizeDueDate(req.body.due_date);
    }

    let completed = Number(cur.completed) === 1 ? 1 : 0;
    if (req.body?.completed !== undefined) {
      completed = req.body.completed === true || req.body.completed === 1 || req.body.completed === '1' ? 1 : 0;
    }

    let sortOrder = cur.sort_order;
    const completedChanged = completed !== Number(cur.completed);
    if (completedChanged) {
      if (completed === 1) {
        const { rows: mx } = await pool.query(
          `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM user_personal_todos WHERE user_id = $1 AND completed = 1`,
          [req.user.id]
        );
        sortOrder = Number(mx[0]?.n) || 0;
      } else {
        const { rows: mx } = await pool.query(
          `SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM user_personal_todos WHERE user_id = $1 AND completed = 0`,
          [req.user.id]
        );
        sortOrder = Number(mx[0]?.n) || 0;
      }
    }

    const { rows } = await pool.query(
      `UPDATE user_personal_todos
       SET title = $1, notes = $2, due_date = $3, completed = $4, sort_order = $5, updated_at = NOW()
       WHERE id = $6 AND user_id = $7
       RETURNING id, title, notes, due_date, completed, sort_order, created_at, updated_at`,
      [title, notes, due_date, completed, sortOrder, req.params.id, req.user.id]
    );
    const row = rows[0];
    const wasDone = Number(cur.completed) === 1;
    const nowDone = completed === 1;
    let summary;
    if (wasDone !== nowDone) {
      summary = nowDone
        ? `マイToDo「${summaryTitle(row.title)}」を完了にしました`
        : `マイToDo「${summaryTitle(row.title)}」を未完了に戻しました`;
    } else {
      summary = `マイToDo「${summaryTitle(row.title)}」を更新しました`;
    }
    await logActivity(req.user.id, {
      action: 'update',
      targetType: 'personal_todo',
      targetId: req.params.id,
      summary,
      detail: { path: '/my-todos', todo_id: req.params.id },
    });
    res.json(mapRow(row));
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows: delRows } = await pool.query(
      'DELETE FROM user_personal_todos WHERE id = $1 AND user_id = $2 RETURNING title',
      [req.params.id, req.user.id]
    );
    if (delRows.length === 0) return res.status(404).json({ error: '見つかりません' });
    await logActivity(req.user.id, {
      action: 'delete',
      targetType: 'personal_todo',
      targetId: req.params.id,
      summary: `マイToDo「${summaryTitle(delRows[0].title)}」を削除しました`,
      detail: { path: '/my-todos', todo_id: req.params.id },
    });
    res.json({ ok: true });
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

module.exports = router;
