import { useEffect, useState, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Alert,
  FormControlLabel,
  Switch,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Button,
  Divider,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { settingsApi, projectsApi, groupsApi } from '../api';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 8 + ITEM_PADDING_TOP,
    },
  },
};

const GROUP_SELECT_LABEL = '通知先グループ（所属メンバー全員に送信・複数選択可）';
const PROJECT_SELECT_LABEL = 'プロジェクト（複数選択可）';

const emptyForm = () => ({
  name: '',
  enabled: false,
  project_scope: 'all',
  project_ids: [],
  group_ids: [],
  exclude_login: true,
});

function ConfigFormFields({
  form,
  setForm,
  projects,
  groups,
}) {
  return (
    <>
      <TextField
        label="設定名"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        fullWidth
        size="small"
        placeholder="例: 本番プロジェクト向け"
      />
      <FormControlLabel
        control={
          <Switch
            checked={form.enabled}
            onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
            color="primary"
          />
        }
        label="この設定でメール通知を有効にする"
      />
      <Divider />
      <FormControl component="fieldset">
        <FormLabel component="legend">通知する操作の対象プロジェクト</FormLabel>
        <RadioGroup
          value={form.project_scope}
          onChange={(e) => setForm((f) => ({ ...f, project_scope: e.target.value }))}
        >
          <FormControlLabel value="all" control={<Radio />} label="すべてのプロジェクト" />
          <FormControlLabel value="selected" control={<Radio />} label="選択したプロジェクトのみ" />
        </RadioGroup>
      </FormControl>
      {form.project_scope === 'selected' ? (
        <FormControl fullWidth size="small">
          <InputLabel id="dlg-project-multi-label">{PROJECT_SELECT_LABEL}</InputLabel>
          <Select
            labelId="dlg-project-multi-label"
            multiple
            value={form.project_ids}
            onChange={(e) => {
              const v = e.target.value;
              setForm((f) => ({
                ...f,
                project_ids: typeof v === 'string' ? v.split(',') : v,
              }));
            }}
            input={<OutlinedInput label={PROJECT_SELECT_LABEL} />}
            label={PROJECT_SELECT_LABEL}
            renderValue={(sel) =>
              projects
                .filter((p) => sel.includes(p.id))
                .map((p) => p.name)
                .join(', ') || '未選択'
            }
            MenuProps={MenuProps}
          >
            {projects.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                <Checkbox checked={form.project_ids.includes(p.id)} />
                <ListItemText primary={p.name} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : null}
      <FormControl fullWidth size="small">
        <InputLabel id="dlg-group-multi-label">{GROUP_SELECT_LABEL}</InputLabel>
        <Select
          labelId="dlg-group-multi-label"
          multiple
          value={form.group_ids}
          onChange={(e) => {
            const v = e.target.value;
            setForm((f) => ({
              ...f,
              group_ids: typeof v === 'string' ? v.split(',') : v,
            }));
          }}
          input={<OutlinedInput label={GROUP_SELECT_LABEL} />}
          label={GROUP_SELECT_LABEL}
          renderValue={(sel) =>
            groups
              .filter((g) => sel.includes(g.id))
              .map((g) => g.name)
              .join(', ') || '未選択'
          }
          MenuProps={MenuProps}
        >
          {groups.map((g) => (
            <MenuItem key={g.id} value={g.id}>
              <Checkbox checked={form.group_ids.includes(g.id)} />
              <ListItemText primary={g.name} secondary={`${g.member_count ?? 0} 名`} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControlLabel
        control={
          <Switch
            checked={form.exclude_login}
            onChange={(e) => setForm((f) => ({ ...f, exclude_login: e.target.checked }))}
            color="primary"
          />
        }
        label="ログイン成功の操作はメールしない（推奨）"
      />
    </>
  );
}

export default function NotificationSettings() {
  const [loading, setLoading] = useState(true);
  const [configs, setConfigs] = useState([]);
  const [error, setError] = useState('');
  const [mailOk, setMailOk] = useState(false);
  const [projects, setProjects] = useState([]);
  const [groups, setGroups] = useState([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setError('');
    const settled = await Promise.allSettled([
      settingsApi.getMailStatus(),
      settingsApi.listActivityNotifications(),
      projectsApi.getAll(),
      groupsApi.getAll(),
    ]);
    const errParts = [];
    if (settled[0].status === 'fulfilled') {
      setMailOk(Boolean(settled[0].value.data?.configured));
    } else {
      errParts.push('メール設定状態の取得に失敗しました');
    }
    if (settled[1].status === 'fulfilled') {
      setConfigs(Array.isArray(settled[1].value.data) ? settled[1].value.data : []);
    } else {
      errParts.push('通知設定の取得に失敗しました');
    }
    if (settled[2].status === 'fulfilled') {
      setProjects(Array.isArray(settled[2].value.data) ? settled[2].value.data : []);
    } else {
      errParts.push('プロジェクト一覧の取得に失敗しました');
    }
    if (settled[3].status === 'fulfilled') {
      setGroups(Array.isArray(settled[3].value.data) ? settled[3].value.data : []);
    } else {
      errParts.push('グループ一覧の取得に失敗しました');
    }
    if (errParts.length) setError(errParts.join(' / '));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadAll();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError('');
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      name: row.name || '',
      enabled: Boolean(row.enabled),
      project_scope: row.project_scope === 'selected' ? 'selected' : 'all',
      project_ids: Array.isArray(row.project_ids) ? [...row.project_ids] : [],
      group_ids: Array.isArray(row.group_ids) ? [...row.group_ids] : [],
      exclude_login: row.exclude_login !== false,
    });
    setError('');
    setDialogOpen(true);
  };

  const handleSaveDialog = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        enabled: form.enabled,
        project_scope: form.project_scope,
        project_ids: form.project_ids,
        group_ids: form.group_ids,
        exclude_login: form.exclude_login,
      };
      if (editingId) {
        await settingsApi.updateActivityNotification(editingId, payload);
      } else {
        await settingsApi.createActivityNotification(payload);
      }
      setDialogOpen(false);
      await loadAll();
    } catch (e) {
      setError(e.response?.data?.error || e.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('この通知設定を削除しますか？')) return;
    setError('');
    try {
      await settingsApi.deleteActivityNotification(id);
      await loadAll();
    } catch (e) {
      setError(e.response?.data?.error || e.message || '削除に失敗しました');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link component={RouterLink} to="/" underline="hover" color="inherit">
          ダッシュボード
        </Link>
        <Typography color="text.primary">通知設定</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <NotificationsActiveIcon color="primary" />
          <Typography variant="h5">操作履歴メール通知</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          設定を追加
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        複数の通知ルールを登録できます。操作が記録されると、条件に合致する有効な設定ごとに通知先グループへメールします（同一メールアドレスは1通にまとめます）。
      </Typography>

      {!mailOk ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          サーバーの環境変数（MAIL_HOST / MAIL_USER / MAIL_FROM 等）が未設定の場合、メールは送信されません。
        </Alert>
      ) : (
        <Alert severity="info" sx={{ mb: 2 }}>
          メール送信設定は有効です。
        </Alert>
      )}

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      ) : null}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>設定名</TableCell>
              <TableCell>有効</TableCell>
              <TableCell>プロジェクト範囲</TableCell>
              <TableCell>通知グループ数</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {configs.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell>{c.name || '—'}</TableCell>
                <TableCell>{c.enabled ? 'はい' : 'いいえ'}</TableCell>
                <TableCell>
                  {c.project_scope === 'selected' ? '選択プロジェクトのみ' : 'すべて'}
                </TableCell>
                <TableCell>{Array.isArray(c.group_ids) ? c.group_ids.length : 0}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(c)} aria-label="編集">
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(c.id)} aria-label="削除">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {configs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography color="text.secondary" sx={{ py: 2 }}>
                    通知設定がありません。「設定を追加」から作成してください。
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? '通知設定を編集' : '通知設定を追加'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <ConfigFormFields form={form} setForm={setForm} projects={projects} groups={groups} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>
            キャンセル
          </Button>
          <Button variant="contained" onClick={handleSaveDialog} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
