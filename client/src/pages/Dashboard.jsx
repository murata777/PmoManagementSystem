import { useEffect, useState } from 'react';
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

function StatCard({ title, value, color }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography color="text.secondary" gutterBottom>{title}</Typography>
        <Typography variant="h3" sx={{ color }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    dashboardApi.getStats().then((res) => setStats(res.data));
  }, []);

  if (!stats) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;

  const pieData = stats.projectsByStatus.map((s) => ({
    name: STATUS_LABELS[s.status] || s.status,
    value: s.count,
    color: STATUS_COLORS[s.status] || '#ccc',
  }));

  return (
    <Box>
      <Typography variant="h5" gutterBottom>ダッシュボード</Typography>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <StatCard title="総プロジェクト数" value={stats.totalProjects} color="primary.main" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard title="進行中のプロジェクト" value={stats.activeProjects} color="success.main" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard title="総メンバー数" value={stats.totalMembers} color="secondary.main" />
        </Grid>
        <Grid item xs={12} sm={6}>
          <StatCard title="総タスク数" value={stats.totalTasks} color="info.main" />
        </Grid>
        <Grid item xs={12} sm={6}>
          <StatCard title="完了タスク数" value={stats.completedTasks} color="warning.main" />
        </Grid>
      </Grid>

      {pieData.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>プロジェクトステータス内訳</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
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
