import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  Link,
  Tooltip,
} from '@mui/material';
import { PieChart, Pie, Cell, Tooltip as ReTooltip, Legend, ResponsiveContainer } from 'recharts';
import { dashboardApi } from '../api';
import { getStoredUser } from '../auth';
import { getActivityNavTo, getActivityLinkLabel, parseDetail } from '../utils/activityNavigation';

/** 操作履歴・メンバー・グループ・通知設定（専用画面） */
function pathRequiresAdmin(to) {
  if (!to || typeof to !== 'string') return false;
  const p = to.split(/[?#]/)[0];
  if (p === '/activity-history' || p === '/members' || p === '/groups') return true;
  if (p === '/settings/notifications' || p.startsWith('/settings/notifications/')) return true;
  return false;
}

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

const TASK_STATUS_LABELS = {
  todo: '未着手',
  inprogress: '進行中',
  review: 'レビュー',
  done: '完了',
};

function formatDueDateLabel(isoOrDate) {
  if (!isoOrDate) return '';
  const s = String(isoOrDate).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return s;
  return dt.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatActivityWhen(iso) {
  if (!iso) return '';
  const s = String(iso).replace(' ', 'T');
  const d = new Date(/Z|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

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

  const storedUser = getStoredUser();
  const isAdmin = Boolean(storedUser?.is_admin);
  const myName = storedUser?.name != null ? String(storedUser.name) : '';
  const tasksMineLink =
    myName.trim() !== ''
      ? `/tasks?assignee=${encodeURIComponent(myName.trim())}&exclude_done=1`
      : '/tasks?exclude_done=1';
  const pieData = (stats.projectsByStatus || []).map((s) => ({
    name: STATUS_LABELS[s.status] || s.status,
    value: s.count,
    color: STATUS_COLORS[s.status] || '#ccc',
    status: s.status,
  }));

  return (
    <Box>
      <Typography variant="h5" gutterBottom>ダッシュボード</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        あなた向けの集計です。各数値をクリックすると該当画面へ移動します。
      </Typography>
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard
            title="アクセス可能なプロジェクト"
            value={stats.accessibleProjectCount ?? 0}
            color="primary.main"
            to="/projects"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard
            title="担当タスク（未完了）"
            value={stats.myOpenTasksCount ?? 0}
            color="info.main"
            to={tasksMineLink}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard
            title="マイToDo（未完了）"
            value={stats.myOpenPersonalTodosCount ?? 0}
            color="success.main"
            to="/my-todos?filter=active"
          />
        </Grid>
      </Grid>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard title="総プロジェクト数" value={stats.totalProjects} color="primary.main" to="/projects" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard title="進行中のプロジェクト" value={stats.activeProjects} color="success.main" to="/projects?status=active" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard title="総メンバー数" value={stats.totalMembers} color="secondary.main" to={isAdmin ? '/members' : undefined} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <StatCard title="総タスク数" value={stats.totalTasks} color="info.main" to="/projects" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <StatCard title="完了タスク数" value={stats.completedTasks} color="warning.main" to="/projects" />
        </Grid>
      </Grid>

      {Array.isArray(stats.overdueMyTasks) && stats.overdueMyTasks.length > 0 ? (
        <Card sx={{ mb: 3, borderLeft: 4, borderColor: 'error.main' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom color="error">
              期限切れのあなたのタスク
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              担当にあなたが設定され、期日が本日より前で、未完了のタスクです。行をクリックするとプロジェクト詳細へ移動します。
            </Typography>
            <List dense disablePadding>
              {stats.overdueMyTasks.map((t, i) => {
                const to = t.project_id ? `/projects/${t.project_id}` : null;
                const stLabel = TASK_STATUS_LABELS[t.status] || t.status || '';
                const secondary = [t.project_name, `期日 ${formatDueDateLabel(t.due_date)}`, stLabel].filter(Boolean).join(' · ');
                return (
                  <Box key={t.id || i}>
                    {i > 0 ? <Divider component="li" /> : null}
                    {to ? (
                      <ListItemButton component={RouterLink} to={to} alignItems="flex-start" sx={{ py: 1, px: 0, borderRadius: 1 }}>
                        <ListItemText
                          primary={t.title || '（無題）'}
                          secondary={secondary}
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItemButton>
                    ) : (
                      <ListItem alignItems="flex-start" sx={{ py: 1, px: 0 }}>
                        <ListItemText
                          primary={t.title || '（無題）'}
                          secondary={secondary}
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    )}
                  </Box>
                );
              })}
            </List>
          </CardContent>
        </Card>
      ) : null}

      {Array.isArray(stats.overdueMyPersonalTodos) && stats.overdueMyPersonalTodos.length > 0 ? (
        <Card sx={{ mb: 3, borderLeft: 4, borderColor: 'warning.main' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom color="warning.dark">
              期限切れのマイToDo
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              個人用 ToDo のうち、期日が本日より前で未完了のものです。行をクリックすると
              <Link component={RouterLink} to="/my-todos" underline="hover">
                マイToDo
              </Link>
              へ移動します。
            </Typography>
            <List dense disablePadding>
              {stats.overdueMyPersonalTodos.map((row, i) => {
                const secondary = `期日 ${formatDueDateLabel(row.due_date)}`;
                return (
                  <Box key={row.id || i}>
                    {i > 0 ? <Divider component="li" /> : null}
                    <ListItemButton
                      component={RouterLink}
                      to="/my-todos"
                      alignItems="flex-start"
                      sx={{ py: 1, px: 0, borderRadius: 1 }}
                    >
                      <ListItemText
                        primary={row.title || '（無題）'}
                        secondary={secondary}
                        primaryTypographyProps={{ variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItemButton>
                  </Box>
                );
              })}
            </List>
          </CardContent>
        </Card>
      ) : null}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            最近の操作
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            あなたの操作の直近5件です。行をクリックすると関連画面へ移動します（ログインなどリンクのないものは除く）。
            {isAdmin ? (
              <>
                {' '}一覧は
                <Link component={RouterLink} to="/activity-history" underline="hover">
                  操作履歴
                </Link>
                から確認できます。
              </>
            ) : (
              <> 操作履歴の一覧は管理者のみ利用できます。</>
            )}
          </Typography>
          {Array.isArray(stats.recentActivity) && stats.recentActivity.length > 0 ? (
            <List dense disablePadding>
              {stats.recentActivity.map((a, i) => {
                const rawTo = getActivityNavTo(a);
                const to = rawTo && pathRequiresAdmin(rawTo) && !isAdmin ? null : rawTo;
                const linkLabel = getActivityLinkLabel(a);
                const det = parseDetail(a.detail);
                const evalPreview = det?.evaluation_preview;
                const secondary = formatActivityWhen(a.created_at);
                const primaryContent = (
                  <>
                    {a.summary}
                    {evalPreview ? (
                      <Typography component="span" variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                        {evalPreview}
                      </Typography>
                    ) : null}
                  </>
                );
                return (
                  <Box key={a.id || i}>
                    {i > 0 ? <Divider component="li" /> : null}
                    {to ? (
                      <Tooltip title={linkLabel} placement="left" enterDelay={400}>
                        <ListItemButton
                          component={RouterLink}
                          to={to}
                          alignItems="flex-start"
                          sx={{ py: 1, px: 0, borderRadius: 1 }}
                        >
                          <ListItemText
                            primary={primaryContent}
                            secondary={secondary}
                            primaryTypographyProps={{ variant: 'body2' }}
                            secondaryTypographyProps={{ variant: 'caption' }}
                          />
                        </ListItemButton>
                      </Tooltip>
                    ) : (
                      <ListItem alignItems="flex-start" sx={{ py: 1, px: 0 }}>
                        <ListItemText
                          primary={primaryContent}
                          secondary={secondary}
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    )}
                  </Box>
                );
              })}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary">
              まだ操作履歴がありません。
            </Typography>
          )}
        </CardContent>
      </Card>

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
                <ReTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
