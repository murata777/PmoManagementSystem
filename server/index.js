require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authMiddleware = require('./middleware/auth');
const pool = require('./database');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

app.use('/api/auth', require('./routes/auth'));
// /api/projects より長いパスを先に登録しないと、/projects/:id/progress/... が projects ルーターに吸われ 404 になる
app.use('/api/projects/:projectId/fields', authMiddleware, require('./routes/customFields'));
app.use('/api/projects/:projectId/phase-gates', authMiddleware, require('./routes/phaseGates'));
app.use('/api/projects/:projectId/progress', authMiddleware, require('./routes/progress'));
app.use('/api/projects', authMiddleware, require('./routes/projects'));
app.use('/api/tasks', authMiddleware, require('./routes/tasks'));
app.use('/api/members', authMiddleware, require('./routes/members'));
app.use('/api/groups', authMiddleware, require('./routes/groups'));
app.use('/api/tasks/:taskId/comments', authMiddleware, require('./routes/taskComments'));
app.use('/api/activity-logs', authMiddleware, require('./routes/activityLogs'));
app.use('/api/settings', authMiddleware, require('./routes/settings'));

app.get('/api/dashboard', authMiddleware, async (req, res) => {
  try {
    const [total, active, tasks, done, members, byStatus, recentActivity] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM projects'),
      pool.query("SELECT COUNT(*) FROM projects WHERE status = 'active'"),
      pool.query('SELECT COUNT(*) FROM tasks'),
      pool.query("SELECT COUNT(*) FROM tasks WHERE status = 'done'"),
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT status, COUNT(*) as count FROM projects GROUP BY status'),
      pool.query(
        `SELECT al.id, al.action, al.target_type, al.target_id, al.summary, al.detail, al.created_at,
                u.name AS user_name
         FROM activity_logs al
         LEFT JOIN users u ON al.user_id = u.id
         ORDER BY al.created_at DESC
         LIMIT 5`
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
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
