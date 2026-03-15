require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authMiddleware = require('./middleware/auth');
const pool = require('./database');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', authMiddleware, require('./routes/projects'));
app.use('/api/tasks', authMiddleware, require('./routes/tasks'));
app.use('/api/members', authMiddleware, require('./routes/members'));

app.get('/api/dashboard', authMiddleware, async (req, res) => {
  try {
    const [total, active, tasks, done, members, byStatus] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM projects'),
      pool.query("SELECT COUNT(*) FROM projects WHERE status = 'active'"),
      pool.query('SELECT COUNT(*) FROM tasks'),
      pool.query("SELECT COUNT(*) FROM tasks WHERE status = 'done'"),
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT status, COUNT(*) as count FROM projects GROUP BY status'),
    ]);
    res.json({
      totalProjects: Number(total.rows[0].count),
      activeProjects: Number(active.rows[0].count),
      totalTasks: Number(tasks.rows[0].count),
      completedTasks: Number(done.rows[0].count),
      totalMembers: Number(members.rows[0].count),
      projectsByStatus: byStatus.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
