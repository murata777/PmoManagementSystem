import { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Button, Card, CardContent, CardActions, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  IconButton, Chip, Avatar, Alert, Divider, List, ListItem,
  ListItemAvatar, ListItemText, ListItemSecondaryAction, MenuItem, Select,
  FormControl, InputLabel, Tooltip, Paper,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import GroupIcon from '@mui/icons-material/Group';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { groupsApi, membersApi } from '../api';

const EMPTY_FORM = { name: '', description: '' };

function normalizeSearch(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesGroupSearch(g, qRaw) {
  const q = normalizeSearch(qRaw);
  if (!q) return true;
  const terms = q.split(' ').filter(Boolean);
  if (terms.length === 0) return true;
  const n = g.member_count ?? 0;
  const blob = normalizeSearch(
    [g.name, g.description, String(n), `${n}名`].join(' ')
  );
  return terms.every((t) => blob.includes(t));
}

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [detailGroup, setDetailGroup] = useState(null);
  const [addUserId, setAddUserId] = useState('');
  const [searchText, setSearchText] = useState('');
  const [filterMembers, setFilterMembers] = useState('');

  const filteredGroups = useMemo(
    () =>
      groups.filter((g) => {
        const n = g.member_count ?? 0;
        if (filterMembers === 'empty' && n !== 0) return false;
        if (filterMembers === 'has' && n === 0) return false;
        if (!matchesGroupSearch(g, searchText)) return false;
        return true;
      }),
    [groups, filterMembers, searchText]
  );

  useEffect(() => {
    if (detailGroup && !filteredGroups.some((g) => g.id === detailGroup.id)) {
      setDetailGroup(null);
    }
  }, [filteredGroups, detailGroup]);

  const loadGroups = () => groupsApi.getAll().then(res => setGroups(res.data));
  const loadUsers = () => membersApi.getAll().then(res => setAllUsers(res.data));

  useEffect(() => { loadGroups(); loadUsers(); }, []);

  const openDetail = async (group) => {
    const res = await groupsApi.getById(group.id);
    setDetailGroup(res.data);
    setAddUserId('');
  };

  const handleOpen = (group = null) => {
    setEditing(group);
    setForm(group ? { name: group.name, description: group.description || '' } : EMPTY_FORM);
    setError('');
    setOpen(true);
  };

  const handleSave = async () => {
    setError('');
    try {
      if (editing) {
        await groupsApi.update(editing.id, form);
      } else {
        await groupsApi.create(form);
      }
      setOpen(false);
      loadGroups();
    } catch (err) {
      setError(err.response?.data?.error || '保存に失敗しました');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('このグループを削除しますか？（プロジェクトのグループ設定は解除されます）')) {
      await groupsApi.delete(id);
      loadGroups();
      if (detailGroup?.id === id) setDetailGroup(null);
    }
  };

  const handleAddMember = async () => {
    if (!addUserId) return;
    await groupsApi.addMember(detailGroup.id, addUserId);
    const res = await groupsApi.getById(detailGroup.id);
    setDetailGroup(res.data);
    loadGroups();
    setAddUserId('');
  };

  const handleRemoveMember = async (userId) => {
    await groupsApi.removeMember(detailGroup.id, userId);
    const res = await groupsApi.getById(detailGroup.id);
    setDetailGroup(res.data);
    loadGroups();
  };

  const availableUsers = allUsers.filter(u => !detailGroup?.members?.some(m => m.id === u.id));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">グループ管理</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>グループ作成</Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField
              label="キーワード検索（名前・説明・メンバー数）"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              fullWidth
              size="small"
              placeholder="複数語は空白区切り（すべて含む行のみ表示）"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField
              select
              label="メンバー数"
              value={filterMembers}
              onChange={(e) => setFilterMembers(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="">すべて</MenuItem>
              <MenuItem value="empty">0名</MenuItem>
              <MenuItem value="has">1名以上</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {filteredGroups.length} 件表示（全 {groups.length} 件）
      </Typography>

      <Grid container spacing={3}>
        {/* グループ一覧 */}
        <Grid item xs={12} md={detailGroup ? 5 : 12}>
          <Grid container spacing={2}>
            {filteredGroups.map(g => (
              <Grid item xs={12} sm={detailGroup ? 12 : 6} md={detailGroup ? 12 : 4} key={g.id}>
                <Card
                  sx={{ cursor: 'pointer', border: detailGroup?.id === g.id ? '2px solid' : '1px solid', borderColor: detailGroup?.id === g.id ? 'primary.main' : 'divider' }}
                  onClick={() => openDetail(g)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <GroupIcon color="primary" />
                      <Typography variant="h6" noWrap>{g.name}</Typography>
                    </Box>
                    {g.description && <Typography variant="body2" color="text.secondary" noWrap>{g.description}</Typography>}
                    <Chip label={`${g.member_count}名`} size="small" sx={{ mt: 1 }} />
                  </CardContent>
                  <CardActions onClick={e => e.stopPropagation()}>
                    <Tooltip title="編集">
                      <IconButton size="small" onClick={() => handleOpen(g)}><EditIcon /></IconButton>
                    </Tooltip>
                    <Tooltip title="削除">
                      <IconButton size="small" color="error" onClick={() => handleDelete(g.id)}><DeleteIcon /></IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))}
            {groups.length === 0 && (
              <Grid item xs={12}>
                <Typography color="text.secondary" align="center">グループがありません</Typography>
              </Grid>
            )}
            {groups.length > 0 && filteredGroups.length === 0 && (
              <Grid item xs={12}>
                <Typography color="text.secondary" align="center">条件に一致するグループがありません</Typography>
              </Grid>
            )}
          </Grid>
        </Grid>

        {/* グループ詳細・メンバー管理 */}
        {detailGroup && (
          <Grid item xs={12} md={7}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">{detailGroup.name} - メンバー管理</Typography>
                  <IconButton size="small" onClick={() => setDetailGroup(null)}>×</IconButton>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <FormControl size="small" sx={{ flexGrow: 1 }}>
                    <InputLabel>メンバーを追加</InputLabel>
                    <Select
                      value={addUserId}
                      onChange={e => setAddUserId(e.target.value)}
                      label="メンバーを追加"
                    >
                      {availableUsers.map(u => (
                        <MenuItem key={u.id} value={u.id}>{u.name}（{u.email}）</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button variant="contained" startIcon={<PersonAddIcon />} onClick={handleAddMember} disabled={!addUserId}>
                    追加
                  </Button>
                </Box>

                <Divider sx={{ mb: 1 }} />

                <List dense>
                  {detailGroup.members?.map(m => (
                    <ListItem key={m.id}>
                      <ListItemAvatar>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}>
                          {m.name.charAt(0)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={m.name}
                        secondary={`${m.email}${m.role ? ' / ' + m.role : ''}`}
                      />
                      <ListItemSecondaryAction>
                        <IconButton size="small" color="error" onClick={() => handleRemoveMember(m.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                  {detailGroup.members?.length === 0 && (
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                      メンバーがいません
                    </Typography>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* グループ作成・編集ダイアログ */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'グループ編集' : 'グループ作成'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="グループ名 *"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            fullWidth autoFocus
          />
          <TextField
            label="説明"
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            fullWidth multiline rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name}>保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
