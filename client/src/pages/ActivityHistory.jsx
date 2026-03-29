import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
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
  TablePagination,
  Breadcrumbs,
  Link,
  Alert,
  IconButton,
  Tooltip,
  TextField,
  MenuItem,
  Grid,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { activityLogsApi, projectsApi, membersApi } from '../api';
import { getActivityNavTo, getActivityLinkLabel, parseDetail } from '../utils/activityNavigation';

function formatWhen(iso) {
  if (!iso) return '—';
  const s = String(iso).replace(' ', 'T');
  const d = new Date(/Z|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}Z`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function projectLinkForRow(row, navigate) {
  const to = getActivityNavTo(row);
  if (!to) return null;
  return {
    label: getActivityLinkLabel(row),
    onClick: () => navigate(to),
  };
}

export default function ActivityHistory() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [filterProjectId, setFilterProjectId] = useState('');
  const [filterUserId, setFilterUserId] = useState('');

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja')),
    [projects]
  );

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja')),
    [members]
  );

  useEffect(() => {
    projectsApi.getAll().then((res) => setProjects(res.data || [])).catch(() => setProjects([]));
    membersApi.getAll().then((res) => setMembers(res.data || [])).catch(() => setMembers([]));
  }, []);

  useEffect(() => {
    setPage(0);
  }, [filterProjectId, filterUserId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        limit: rowsPerPage,
        offset: page * rowsPerPage,
      };
      if (filterProjectId) params.project_id = filterProjectId;
      if (filterUserId) params.user_id = filterUserId;
      const res = await activityLogsApi.getAll(params);
      setItems(res.data.items || []);
      setTotal(res.data.total ?? 0);
    } catch (e) {
      setError(e.response?.data?.error || e.message || '読み込みに失敗しました');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filterProjectId, filterUserId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/" underline="hover" color="inherit">
          ダッシュボード
        </Link>
        <Typography color="text.primary">操作履歴</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <HistoryIcon color="primary" />
        <Typography variant="h5">操作履歴</Typography>
      </Box>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      ) : null}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              select
              label="プロジェクトで絞り込み"
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
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              select
              label="ユーザーで絞り込み"
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="">すべて</MenuItem>
              {sortedMembers.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {m.name}
                  {m.email ? `（${m.email}）` : ''}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 180 }}>日時</TableCell>
              <TableCell sx={{ width: 140 }}>ユーザー</TableCell>
              <TableCell sx={{ minWidth: 140 }}>プロジェクト</TableCell>
              <TableCell sx={{ width: 100 }}>操作</TableCell>
              <TableCell sx={{ width: 160 }}>対象</TableCell>
              <TableCell>内容</TableCell>
              <TableCell align="right" sx={{ width: 56 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    読み込み中…
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
            {!loading && items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    履歴がありません。
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
            {items.map((row) => {
              const link = projectLinkForRow(row, navigate);
              const det = parseDetail(row.detail);
              const evalPreview = det?.evaluation_preview;
              return (
                <TableRow key={row.id} hover>
                  <TableCell>{formatWhen(row.created_at)}</TableCell>
                  <TableCell>{row.user_name || '—'}</TableCell>
                  <TableCell>
                    {row.project_name ? (
                      <Typography variant="body2" noWrap title={row.project_name}>
                        {row.project_name}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        —
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{row.action}</TableCell>
                  <TableCell>
                    {row.target_type}
                    {row.target_id ? (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ wordBreak: 'break-all' }}>
                        {row.target_id}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {row.summary}
                    {evalPreview ? (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                        {evalPreview}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell align="right">
                    {link ? (
                      <Tooltip title={link.label}>
                        <IconButton size="small" onClick={link.onClick} aria-label={link.label}>
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
          labelRowsPerPage="表示件数"
        />
      </TableContainer>
    </Box>
  );
}
