const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authMiddleware = require('./middleware/auth');
const requireAdmin = require('./middleware/requireAdmin');
const { requireProjectIdParam, requireTaskIdParam } = require('./middleware/requireUuidParams');
const { sendSafeServerError } = require('./utils/httpErrorResponse');
const pool = require('./database');
const app = express();
const PORT = process.env.PORT || 5000;

if (process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : null;
app.use(
  cors(
    corsOrigins && corsOrigins.length
      ? { origin: corsOrigins, credentials: true }
      : { origin: true, credentials: true }
  )
);
app.use(express.json({ limit: '15mb' }));

app.use('/api/auth', require('./routes/auth'));
// /api/projects より長いパスを先に登録しないと、/projects/:id/progress/... が projects ルーターに吸われ 404 になる
app.use('/api/projects/:projectId/fields', authMiddleware, requireProjectIdParam, require('./routes/customFields'));
app.use('/api/projects/:projectId/phase-gates', authMiddleware, requireProjectIdParam, require('./routes/phaseGates'));
app.use('/api/projects/:projectId/progress', authMiddleware, requireProjectIdParam, require('./routes/progress'));
app.use('/api/projects', authMiddleware, require('./routes/projects'));
app.use('/api/tasks', authMiddleware, require('./routes/tasks'));
app.use('/api/members', authMiddleware, require('./routes/members'));
app.use('/api/groups', authMiddleware, require('./routes/groups'));
app.use('/api/tasks/:taskId/comments', authMiddleware, requireTaskIdParam, require('./routes/taskComments'));
app.use('/api/activity-logs', authMiddleware, requireAdmin, require('./routes/activityLogs'));
app.use('/api/settings', authMiddleware, require('./routes/settings'));
app.use('/api/favorites', authMiddleware, require('./routes/favorites'));
app.use('/api/my-todos', authMiddleware, require('./routes/myTodos'));
app.use('/api/feature-requests', authMiddleware, require('./routes/featureRequests'));

app.get('/api/dashboard', authMiddleware, async (req, res) => {
  try {
    const userName = req.user.name != null ? String(req.user.name) : '';
    const userId = req.user.id;

    const [
      total,
      active,
      tasks,
      done,
      members,
      byStatus,
      recentActivity,
      overdueMyTasks,
      overdueMyPersonalTodos,
      accessibleProjects,
      myOpenTasks,
      myOpenPersonalTodos,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM projects'),
      pool.query("SELECT COUNT(*) FROM projects WHERE status = 'active'"),
      pool.query('SELECT COUNT(*) FROM tasks'),
      pool.query("SELECT COUNT(*) FROM tasks WHERE status = 'done'"),
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT status, COUNT(*) as count FROM projects GROUP BY status'),
      pool.query(
        `SELECT al.id, al.action, al.target_type, al.target_id, al.summary, al.detail, al.created_at
         FROM activity_logs al
         WHERE al.user_id = $1
         ORDER BY al.created_at DESC
         LIMIT 5`,
        [userId]
      ),
      pool.query(
        `SELECT t.id, t.project_id, t.title, t.status, t.priority, t.due_date, p.name AS project_name
         FROM tasks t
         INNER JOIN projects p ON p.id = t.project_id
         WHERE NULLIF(TRIM(COALESCE(t.assignee, '')), '') IS NOT NULL
           AND (TRIM(COALESCE(t.assignee, '')) = TRIM(COALESCE($1::text, '')) OR t.assignee = $2::text)
           AND COALESCE(t.status, '') <> 'done'
           AND NULLIF(TRIM(COALESCE(t.due_date, '')), '') IS NOT NULL
           AND LENGTH(TRIM(t.due_date)) >= 10
           AND (LEFT(TRIM(t.due_date), 10))::date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::date
           AND (
             p.group_id IS NULL
             OR EXISTS (
               SELECT 1 FROM user_groups ug
               WHERE ug.group_id = p.group_id AND ug.user_id = $2
             )
           )
         ORDER BY (LEFT(TRIM(t.due_date), 10))::date ASC, p.name ASC, t.title ASC
         LIMIT 50`,
        [userName, userId]
      ),
      pool.query(
        `SELECT id, title, due_date, sort_order
         FROM user_personal_todos
         WHERE user_id = $1
           AND completed = 0
           AND NULLIF(TRIM(COALESCE(due_date, '')), '') IS NOT NULL
           AND LENGTH(TRIM(due_date)) >= 10
           AND (LEFT(TRIM(due_date), 10))::date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo')::date
         ORDER BY (LEFT(TRIM(due_date), 10))::date ASC, sort_order ASC, title ASC
         LIMIT 50`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count FROM projects p
         WHERE p.group_id IS NULL
            OR EXISTS (
              SELECT 1 FROM user_groups ug
              WHERE ug.group_id = p.group_id AND ug.user_id = $1
            )`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count
         FROM tasks t
         INNER JOIN projects p ON p.id = t.project_id
         WHERE COALESCE(t.status, '') <> 'done'
           AND NULLIF(TRIM(COALESCE(t.assignee, '')), '') IS NOT NULL
           AND (
             TRIM(COALESCE(t.assignee, '')) = TRIM(COALESCE($1::text, ''))
             OR t.assignee = $2::text
           )
           AND (
             p.group_id IS NULL
             OR EXISTS (
               SELECT 1 FROM user_groups ug
               WHERE ug.group_id = p.group_id AND ug.user_id = $2
             )
           )`,
        [userName, userId]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS count
         FROM user_personal_todos
         WHERE user_id = $1 AND completed = 0`,
        [userId]
      ),
    ]);
    res.json({
      totalProjects: Number(total.rows[0].count),
      activeProjects: Number(active.rows[0].count),
      totalTasks: Number(tasks.rows[0].count),
      completedTasks: Number(done.rows[0].count),
      totalMembers: Number(members.rows[0].count),
      projectsByStatus: byStatus.rows,
      recentActivity: recentActivity.rows,
      overdueMyTasks: overdueMyTasks.rows,
      overdueMyPersonalTodos: overdueMyPersonalTodos.rows,
      accessibleProjectCount: Number(accessibleProjects.rows[0]?.count ?? 0),
      myOpenTasksCount: Number(myOpenTasks.rows[0]?.count ?? 0),
      myOpenPersonalTodosCount: Number(myOpenPersonalTodos.rows[0]?.count ?? 0),
    });
  } catch (err) {
    sendSafeServerError(res, err);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
