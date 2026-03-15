const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/members', require('./routes/members'));

app.get('/api/dashboard', (req, res) => {
  const db = require('./database');
  const stats = {};
  db.get('SELECT COUNT(*) as total FROM projects', (err, row) => {
    stats.totalProjects = row?.total || 0;
    db.get("SELECT COUNT(*) as total FROM projects WHERE status = 'active'", (err, row) => {
      stats.activeProjects = row?.total || 0;
      db.get('SELECT COUNT(*) as total FROM tasks', (err, row) => {
        stats.totalTasks = row?.total || 0;
        db.get("SELECT COUNT(*) as total FROM tasks WHERE status = 'done'", (err, row) => {
          stats.completedTasks = row?.total || 0;
          db.get('SELECT COUNT(*) as total FROM members', (err, row) => {
            stats.totalMembers = row?.total || 0;
            db.all("SELECT status, COUNT(*) as count FROM projects GROUP BY status", (err, rows) => {
              stats.projectsByStatus = rows || [];
              res.json(stats);
            });
          });
        });
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
