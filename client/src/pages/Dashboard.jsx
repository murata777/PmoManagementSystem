import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Grid, Card, CardContent, Typography, Box, CircularProgress } from '@mui/material';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { dashboardApi } from '../api';

const STATUS_COLORS = {
  planning: '#2196f3',
  active: '#4caf50',
  onhold: '#ff9800',
  completed: '#9c27b0',
};

const STATUS_LABELS = {
  planning: '計画中',
  active: '進行中',
  onhold: '保留',
  completed: '完了',
};

function StatCard({ title, value, color, to }) {
  const content = (
    <CardContent>
      <Typography color="text.secondary" gutterBottom>{title}</Typography>
      <Typography variant="h3" sx={{ color }}>{value}</Typography>
    </CardContent>
  );

  if (to) {
    return (
      <Card
        component={RouterLink}
        to={to}
        sx={{
          height: '100%',
          textDecoration: 'none',
          color: 'inherit',
          display: 'block',
          transition: (theme) => theme.transitions.create(['box-shadow', 'transform'], { duration: theme.transitions.duration.shorter }),
          '&:hover': {
            boxShadow: 4,
            transform: 'translateY(-2px)',
          },
        }}
      >
        {content}
      </Card>
    );
  }

  return (
    <Card sx={{ height: '100%' }}>
      {content}
    </Card>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    dashboardApi.getStats().then((res) => setStats(res.data));
  }, []);

  if (!stats) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;

  const pieData = stats.projectsByStatus.map((s) => ({
    name: STATUS_LABELS[s.status] || s.status,
    value: s.count,
    color: STATUS_COLORS[s.status] || '#ccc',
    status: s.status,
  }));

  return (
    <Box>
      <Typography variant="h5" gutterBottom>ダッシュボード</Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard title="総プロジェクト数" value={stats.totalProjects} color="primary.main" to="/projects" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard title="進行中のプロジェクト" value={stats.activeProjects} color="success.main" to="/projects?status=active" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard title="総メンバー数" value={stats.totalMembers} color="secondary.main" to="/members" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <StatCard title="総タスク数" value={stats.totalTasks} color="info.main" to="/projects" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <StatCard title="完了タスク数" value={stats.completedTasks} color="warning.main" to="/projects" />
        </Grid>
      </Grid>

      {pieData.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>プロジェクトステータス内訳</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              グラフの扇形をクリックすると、そのステータスのプロジェクト一覧へ移動します。
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                  style={{ cursor: 'pointer' }}
                  onClick={(slice) => {
                    const st = slice?.payload?.status;
                    if (st) navigate(`/projects?status=${encodeURIComponent(st)}`);
                  }}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
