import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem,
  Divider, Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import GroupIcon from '@mui/icons-material/Group';
import { projectsApi, groupsApi, membersApi } from '../api';
import { fmtEvmIndex, evmIndexChipColor } from '../utils/evm';

const STATUS_OPTIONS = [
  { value: 'planning', label: '計画中' },
  { value: 'active', label: '進行中' },
  { value: 'onhold', label: '保留' },
  { value: 'completed', label: '完了' },
];
const PRIORITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
];
const STATUS_COLORS = { planning: 'info', active: 'success', onhold: 'warning', completed: 'secondary' };
const PRIORITY_COLORS = { low: 'default', medium: 'primary', high: 'error' };
const EMPTY_FORM = { name: '', description: '', status: 'planning', priority: 'medium', start_date: '', end_date: '', manager: '', group_id: '' };

const projectToForm = (p) => ({
  name: p.name,
  description: p.description || '',
  status: p.status,
  priority: p.priority,
  start_date: p.start_date || '',
  end_date: p.end_date || '',
  manager: p.manager || '',
  group_id: p.group_id || '',
});
const EMPTY_MEMBER_FORM = { name: '', email: '', role: '', department: '' };

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [groups, setGroups] = useState([]);
  const [members, setMembers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupError, setGroupError] = useState('');
  const [showNewMember, setShowNewMember] = useState(false);
  const [newMemberForm, setNewMemberForm] = useState(EMPTY_MEMBER_FORM);
  const [memberError, setMemberError] = useState('');
  const [memberAdded, setMemberAdded] = useState('');
  const navigate = useNavigate();

  const load = () => projectsApi.getAll().then(res => setProjects(res.data));
  const loadGroups = () => groupsApi.getAll().then(res => setGroups(res.data));
  const loadMembers = () => membersApi.getAll().then(res => setMembers(res.data));

  useEffect(() => { load(); loadGroups(); loadMembers(); }, []);

  const handleOpen = (project = null) => {
    setEditing(project);
    setForm(project ? projectToForm(project) : EMPTY_FORM);
    setNewGroupName('');
    setShowNewGroup(false);
    setGroupError('');
    setShowNewMember(false);
    setNewMemberForm(EMPTY_MEMBER_FORM);
    setMemberError('');
    setMemberAdded('');
    setOpen(true);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setGroupError('');
    try {
      const res = await groupsApi.create({ name: newGroupName.trim() });
      await loadGroups();
      setForm(f => ({ ...f, group_id: res.data.id }));
      setNewGroupName('');
      setShowNewGroup(false);
    } catch (err) {
      setGroupError(err.response?.data?.error || 'グループ作成に失敗しました');
    }
  };

  const handleCreateMember = async () => {
    if (!newMemberForm.name.trim() || !newMemberForm.email.trim()) return;
    setMemberError('');
    try {
      const res = await membersApi.create(newMemberForm);
      const newMemberId = res.data.id;
      if (form.group_id && newMemberId) {
        await groupsApi.addMember(form.group_id, newMemberId);
        await loadGroups();
      }
      await loadMembers();
      setForm(f => ({ ...f, manager: newMemberForm.name.trim() }));
      setMemberAdded(newMemberForm.name.trim());
      setNewMemberForm(EMPTY_MEMBER_FORM);
      setShowNewMember(false);
    } catch (err) {
      setMemberError(err.response?.data?.error || 'メンバー追加に失敗しました');
    }
  };

  const handleSave = async () => {
    const data = {
      name: form.name,
      description: form.description,
      status: form.status,
      priority: form.priority,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      manager: form.manager || null,
      group_id: form.group_id || null,
    };
    if (editing) {
      await projectsApi.update(editing.id, data);
    } else {
      await projectsApi.create(data);
    }
    setOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    if (window.confirm('このプロジェクトを削除しますか？')) {
      await projectsApi.delete(id);
      load();
    }
  };

  return (
    <Box sx={{ mx: -2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">プロジェクト一覧</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>新規作成</Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ '& th': { whiteSpace: 'nowrap' } }}>
              <TableCell>プロジェクト名</TableCell>
              <TableCell>グループ</TableCell>
              <TableCell>ステータス</TableCell>
              <TableCell>優先度</TableCell>
              <TableCell>担当PM</TableCell>
              <TableCell>期間</TableCell>
              <TableCell>EVM（最新）</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projects.map(p => (
              <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${p.id}`)}>
                <TableCell><Typography fontWeight="bold">{p.name}</Typography></TableCell>
                <TableCell>
                  {p.group_name
                    ? <Chip icon={<GroupIcon />} label={p.group_name} size="small" color="primary" variant="outlined" />
                    : <Typography variant="caption" color="text.secondary">全員</Typography>
                  }
                </TableCell>
                <TableCell><Chip label={STATUS_OPTIONS.find(s => s.value === p.status)?.label || p.status} color={STATUS_COLORS[p.status] || 'default'} size="small" /></TableCell>
                <TableCell><Chip label={PRIORITY_OPTIONS.find(s => s.value === p.priority)?.label || p.priority} color={PRIORITY_COLORS[p.priority] || 'default'} size="small" /></TableCell>
                <TableCell>{p.manager || '-'}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {p.start_date || p.end_date
                    ? `${p.start_date || '?'} ～ ${p.end_date || '?'}`
                    : '-'}
                </TableCell>
                <TableCell sx={{ minWidth: 160 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      <Chip
                        label={`SPI ${fmtEvmIndex(p.evm_spi)}`}
                        color={evmIndexChipColor(p.evm_spi)}
                        size="small"
                        variant={p.evm_spi == null ? 'outlined' : 'filled'}
                      />
                      <Chip
                        label={`CPI ${fmtEvmIndex(p.evm_cpi)}`}
                        color={evmIndexChipColor(p.evm_cpi)}
                        size="small"
                        variant={p.evm_cpi == null ? 'outlined' : 'filled'}
                      />
                    </Box>
                    {p.evm_as_of ? (
                      <Typography variant="caption" color="text.secondary">
                        基準日 {p.evm_as_of}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        進捗記録なし
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell align="right" onClick={e => e.stopPropagation()}>
                  <IconButton size="small" onClick={() => handleOpen(p)}><EditIcon /></IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(p.id)}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {projects.length === 0 && (
              <TableRow><TableCell colSpan={8} align="center">プロジェクトがありません（アクセス可能なプロジェクトがありません）</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'プロジェクト編集' : '新規プロジェクト'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="プロジェクト名 *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth />
          <TextField label="説明" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} fullWidth multiline rows={2} />

          {/* グループ選択 */}
          <TextField label="グループ（未設定=全員アクセス可）" select value={form.group_id} onChange={e => setForm({ ...form, group_id: e.target.value })} fullWidth>
            <MenuItem value="">設定しない（全員アクセス可）</MenuItem>
            <Divider />
            {groups.map(g => <MenuItem key={g.id} value={g.id}>{g.name}（{g.member_count}名）</MenuItem>)}
          </TextField>

          {/* 新規グループ作成 */}
          {!showNewGroup ? (
            <Button size="small" startIcon={<AddIcon />} onClick={() => setShowNewGroup(true)} sx={{ alignSelf: 'flex-start' }}>
              新しいグループを作成
            </Button>
          ) : (
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
              <Typography variant="body2" gutterBottom fontWeight="bold">新規グループ作成</Typography>
              {groupError && <Alert severity="error" sx={{ mb: 1 }}>{groupError}</Alert>}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  label="グループ名"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  size="small"
                  fullWidth
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
                />
                <Button variant="contained" size="small" onClick={handleCreateGroup} disabled={!newGroupName.trim()}>作成</Button>
                <Button size="small" onClick={() => { setShowNewGroup(false); setGroupError(''); }}>キャンセル</Button>
              </Box>
            </Box>
          )}

          <Divider />
          <TextField label="ステータス" select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} fullWidth>
            {STATUS_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
          <TextField label="優先度" select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} fullWidth>
            {PRIORITY_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
          {/* 担当PM選択 */}
          <TextField label="担当PM" select value={form.manager || ''} onChange={e => setForm({ ...form, manager: e.target.value })} fullWidth>
            <MenuItem value="">（未設定）</MenuItem>
            <Divider />
            {members.map(m => <MenuItem key={m.id} value={m.name}>{m.name}</MenuItem>)}
          </TextField>

          {/* 新規メンバー追加 */}
          {memberAdded && (
            <Alert severity="success">
              「{memberAdded}」を追加し、担当PMに設定しました。
              {form.group_id && ` グループにも自動追加されました。`}
            </Alert>
          )}
          {!showNewMember ? (
            <Button size="small" startIcon={<AddIcon />} onClick={() => setShowNewMember(true)} sx={{ alignSelf: 'flex-start' }}>
              新しいメンバーを追加
            </Button>
          ) : (
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
              <Typography variant="body2" gutterBottom fontWeight="bold">新規メンバー追加</Typography>
              {memberError && <Alert severity="error" sx={{ mb: 1 }}>{memberError}</Alert>}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField label="名前 *" value={newMemberForm.name} onChange={e => setNewMemberForm({ ...newMemberForm, name: e.target.value })} size="small" fullWidth autoFocus />
                  <TextField label="メールアドレス *" type="email" value={newMemberForm.email} onChange={e => setNewMemberForm({ ...newMemberForm, email: e.target.value })} size="small" fullWidth helperText="招待メールを送信します" />
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField label="役職" value={newMemberForm.role} onChange={e => setNewMemberForm({ ...newMemberForm, role: e.target.value })} size="small" fullWidth />
                  <TextField label="部署" value={newMemberForm.department} onChange={e => setNewMemberForm({ ...newMemberForm, department: e.target.value })} size="small" fullWidth />
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button variant="contained" size="small" onClick={handleCreateMember} disabled={!newMemberForm.name.trim() || !newMemberForm.email.trim()}>追加して招待</Button>
                  <Button size="small" onClick={() => { setShowNewMember(false); setMemberError(''); }}>キャンセル</Button>
                </Box>
              </Box>
            </Box>
          )}
          <TextField label="開始日" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
          <TextField label="終了日" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name}>保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
