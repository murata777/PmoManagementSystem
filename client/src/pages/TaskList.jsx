import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  MenuItem,
  Grid,
  Chip,
  Breadcrumbs,
  Link,
  Alert,
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { projectsApi, tasksApi } from '../api';

const TASK_STATUS = [
  { value: 'todo', label: '未着手' },
  { value: 'inprogress', label: '進行中' },
  { value: 'review', label: 'レビュー中' },
  { value: 'done', label: '完了' },
];
const TASK_STATUS_COLORS = { todo: 'default', inprogress: 'info', review: 'warning', done: 'success' };
const PRIORITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
];
const PRIORITY_COLORS = { low: 'default', medium: 'primary', high: 'error' };

function taskStatusLabel(value) {
  return TASK_STATUS.find((s) => s.value === value)?.label || value || '—';
}
function priorityLabel(value) {
  return PRIORITY_OPTIONS.find((p) => p.value === value)?.label || value || '—';
}

function normalizeSearch(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** 空白区切りの各語が、いずれかのフィールドに含まれるか（AND） */
function matchesFullText(task, projectName, qRaw) {
  const q = normalizeSearch(qRaw);
  if (!q) return true;
  const terms = q.split(' ').filter(Boolean);
  if (terms.length === 0) return true;
  const blob = normalizeSearch(
    [
      task.title,
      task.description,
      task.assignee,
      task.status,
      taskStatusLabel(task.status),
      task.priority,
      priorityLabel(task.priority),
      task.due_date,
      projectName,
    ].join(' ')
  );
  return terms.every((t) => blob.includes(t));
}

export default function TaskList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [filterProjectId, setFilterProjectId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterDueFrom, setFilterDueFrom] = useState('');
  const [filterDueTo, setFilterDueTo] = useState('');
  const [searchText, setSearchText] = useState('');
  const [excludeDone, setExcludeDone] = useState(false);

  useEffect(() => {
    const assigneeQ = searchParams.get('assignee');
    if (assigneeQ != null && String(assigneeQ).trim() !== '') {
      try {
        setFilterAssignee(decodeURIComponent(assigneeQ));
      } catch {
        setFilterAssignee(assigneeQ);
      }
    } else {
      setFilterAssignee('');
    }
    setExcludeDone(searchParams.get('exclude_done') === '1');
  }, [searchParams]);

  const projectById = useMemo(() => {
    const m = new Map();
    projects.forEach((p) => m.set(p.id, p));
    return m;
  }, [projects]);

  const assigneeOptions = useMemo(() => {
    const set = new Set();
    tasks.forEach((t) => {
      const a = String(t.assignee || '').trim();
      if (a) set.add(a);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'ja'));
  }, [tasks]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([tasksApi.getAll(), projectsApi.getAll()])
      .then(([tasksRes, projectsRes]) => {
        if (cancelled) return;
        setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
        setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : []);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.response?.data?.error || e.message || '読み込みに失敗しました');
          setTasks([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredTasks = useMemo(() => {
    const hasDueFilter = Boolean(filterDueFrom || filterDueTo);
    return tasks.filter((t) => {
      if (filterProjectId && t.project_id !== filterProjectId) return false;
      if (excludeDone && t.status === 'done') return false;
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterAssignee && String(t.assignee || '').trim() !== filterAssignee) return false;
      const d = t.due_date ? String(t.due_date).slice(0, 10) : '';
      if (hasDueFilter) {
        if (!d) return false;
        if (filterDueFrom && d < filterDueFrom) return false;
        if (filterDueTo && d > filterDueTo) return false;
      }
      const pName = projectById.get(t.project_id)?.name || '';
      if (!matchesFullText(t, pName, searchText)) return false;
      return true;
    });
  }, [
    tasks,
    filterProjectId,
    excludeDone,
    filterStatus,
    filterAssignee,
    filterDueFrom,
    filterDueTo,
    searchText,
    projectById,
  ]);

  const openProjectTask = (task) => {
    navigate(`/projects/${task.project_id}#task-${encodeURIComponent(task.id)}`);
  };

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja')),
    [projects]
  );

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/" underline="hover" color="inherit">
          ダッシュボード
        </Link>
        <Typography color="text.primary">タスク一覧</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <AssignmentIcon color="primary" />
        <Typography variant="h5">タスク一覧</Typography>
      </Box>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      ) : null}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="キーワード検索（タイトル・説明・担当・ステータス・優先度・期日・プロジェクト名）"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              fullWidth
              size="small"
              placeholder="複数語は空白区切り（すべて含む行のみ表示）"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField
              select
              label="プロジェクト"
              value={filterProjectId}
              onChange={(e) => setFilterProjectId(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="">すべて</MenuItem>
              {sortedProjects.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField
              select
              label="ステータス"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="">すべて</MenuItem>
              {TASK_STATUS.map((s) => (
                <MenuItem key={s.value} value={s.value}>
                  {s.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <TextField
              select
              label="担当者"
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="">すべて</MenuItem>
              {assigneeOptions.map((a) => (
                <MenuItem key={a} value={a}>
                  {a}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <TextField
              label="期日（から）"
              type="date"
              value={filterDueFrom}
              onChange={(e) => setFilterDueFrom(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ flex: '1 1 140px', minWidth: 140 }}
            />
            <TextField
              label="期日（まで）"
              type="date"
              value={filterDueTo}
              onChange={(e) => setFilterDueTo(e.target.value)}
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={{ flex: '1 1 140px', minWidth: 140 }}
            />
          </Grid>
        </Grid>
      </Paper>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {loading ? '読み込み中…' : `${filteredTasks.length} 件表示（全 ${tasks.length} 件）`}
      </Typography>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>タスク名</TableCell>
              <TableCell>プロジェクト</TableCell>
              <TableCell>ステータス</TableCell>
              <TableCell>優先度</TableCell>
              <TableCell>担当者</TableCell>
              <TableCell>期日</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && filteredTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    該当するタスクがありません。
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
            {filteredTasks.map((t) => {
              const proj = projectById.get(t.project_id);
              return (
                <TableRow
                  key={t.id}
                  hover
                  onClick={() => openProjectTask(t)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <Typography fontWeight={600}>{t.title || '（無題）'}</Typography>
                    {t.description ? (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {String(t.description).slice(0, 120)}
                        {String(t.description).length > 120 ? '…' : ''}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>{proj?.name || t.project_id || '—'}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={taskStatusLabel(t.status)}
                      color={TASK_STATUS_COLORS[t.status] || 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={priorityLabel(t.priority)}
                      color={PRIORITY_COLORS[t.priority] || 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{t.assignee || '—'}</TableCell>
                  <TableCell>{t.due_date || '—'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
