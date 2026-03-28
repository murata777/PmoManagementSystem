import { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Avatar, Chip, Alert, Grid, MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import LockResetIcon from '@mui/icons-material/LockReset';
import { membersApi } from '../api';
import { getStoredUser } from '../auth';

const EMPTY_FORM = { name: '', email: '', role: '', department: '' };

function normalizeSearch(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesMemberSearch(m, qRaw) {
  const q = normalizeSearch(qRaw);
  if (!q) return true;
  const terms = q.split(' ').filter(Boolean);
  if (terms.length === 0) return true;
  const statusLabel = m.is_temp_password ? '初期pw未変更' : '有効';
  const blob = normalizeSearch(
    [m.name, m.email, m.role, m.department, statusLabel].join(' ')
  );
  return terms.every((t) => blob.includes(t));
}

export default function Members() {
  const [members, setMembers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [newTempPassword, setNewTempPassword] = useState('');
  const currentUser = getStoredUser();

  const [searchText, setSearchText] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterPassword, setFilterPassword] = useState('');

  const roleOptions = useMemo(() => {
    const set = new Set();
    members.forEach((m) => {
      const r = String(m.role || '').trim();
      if (r) set.add(r);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'ja'));
  }, [members]);

  const departmentOptions = useMemo(() => {
    const set = new Set();
    members.forEach((m) => {
      const d = String(m.department || '').trim();
      if (d) set.add(d);
    });
    return [...set].sort((a, b) => a.localeCompare(b, 'ja'));
  }, [members]);

  const filteredMembers = useMemo(
    () =>
      members.filter((m) => {
        if (filterRole && String(m.role || '').trim() !== filterRole) return false;
        if (filterDepartment && String(m.department || '').trim() !== filterDepartment) return false;
        if (filterPassword === 'temp' && !m.is_temp_password) return false;
        if (filterPassword === 'ok' && m.is_temp_password) return false;
        if (!matchesMemberSearch(m, searchText)) return false;
        return true;
      }),
    [members, filterRole, filterDepartment, filterPassword, searchText]
  );

  const load = () => membersApi.getAll().then((res) => setMembers(res.data));
  useEffect(() => { load(); }, []);

  const handleOpen = (member = null) => {
    setEditing(member);
    setForm(member ? { name: member.name, email: member.email, role: member.role || '', department: member.department || '' } : EMPTY_FORM);
    setError('');
    setNewTempPassword('');
    setOpen(true);
  };

  const handleSave = async () => {
    setError('');
    try {
      if (editing) {
        await membersApi.update(editing.id, form);
        setOpen(false);
      } else {
        const res = await membersApi.create(form);
        if (res.data.tempPassword) {
          setNewTempPassword(res.data.tempPassword);
        } else {
          setOpen(false);
        }
      }
      load();
    } catch (err) {
      setError(err.response?.data?.error || '保存に失敗しました');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('このメンバーのアカウントを削除しますか？')) {
      try {
        await membersApi.delete(id);
        load();
      } catch (err) {
        alert(err.response?.data?.error || '削除に失敗しました');
      }
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">メンバー管理</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>メンバー追加</Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>名前</TableCell>
              <TableCell>メールアドレス</TableCell>
              <TableCell>役職</TableCell>
              <TableCell>部署</TableCell>
              <TableCell>状態</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredMembers.map((m) => (
              <TableRow key={m.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: m.id === currentUser?.id ? 'secondary.main' : 'primary.main', fontSize: 14 }}>
                      {m.name.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography fontWeight="bold">{m.name}</Typography>
                      {m.id === currentUser?.id && <Typography variant="caption" color="text.secondary">（あなた）</Typography>}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>{m.email}</TableCell>
                <TableCell>{m.role ? <Chip label={m.role} size="small" /> : '-'}</TableCell>
                <TableCell>{m.department || '-'}</TableCell>
                <TableCell>
                  {m.is_temp_password ? (
                    <Chip icon={<LockResetIcon />} label="初期PW未変更" color="warning" size="small" />
                  ) : (
                    <Chip label="有効" color="success" size="small" />
                  )}
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleOpen(m)}><EditIcon /></IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(m.id)}
                    disabled={m.id === currentUser?.id}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {members.length === 0 && (
              <TableRow><TableCell colSpan={6} align="center">メンバーがいません</TableCell></TableRow>
            )}
            {members.length > 0 && filteredMembers.length === 0 && (
              <TableRow><TableCell colSpan={6} align="center">条件に一致するメンバーがありません</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'メンバー編集' : 'メンバー追加'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {newTempPassword ? (
            <Box>
              <Alert severity="success" sx={{ mb: 1 }}>メンバーを追加しました。</Alert>
              <Alert severity="warning">
                <strong>初期パスワード（開発環境用）:</strong><br />
                <code style={{ fontSize: '1.1em' }}>{newTempPassword}</code><br />
                <small>本番環境ではメールで通知されます。</small>
              </Alert>
            </Box>
          ) : (
            <>
              <TextField
                label="名前 *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                fullWidth
                disabled={!!editing && editing.id === currentUser?.id}
              />
              <TextField
                label="メールアドレス *"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                fullWidth
                helperText={!editing ? '初期パスワードをこのアドレスに送信します' : ''}
              />
              <TextField
                label="役職"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                fullWidth
              />
              <TextField
                label="部署"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                fullWidth
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{newTempPassword ? '閉じる' : 'キャンセル'}</Button>
          {!newTempPassword && (
            <Button variant="contained" onClick={handleSave} disabled={!form.name || !form.email}>
              {editing ? '保存' : '追加して招待'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
