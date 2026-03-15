import { useEffect, useState } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Avatar, Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { membersApi } from '../api';

const EMPTY_FORM = { name: '', email: '', role: '', department: '' };

export default function Members() {
  const [members, setMembers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = () => membersApi.getAll().then((res) => setMembers(res.data));
  useEffect(() => { load(); }, []);

  const handleOpen = (member = null) => {
    setEditing(member);
    setForm(member ? { ...member } : EMPTY_FORM);
    setOpen(true);
  };

  const handleSave = async () => {
    if (editing) {
      await membersApi.update(editing.id, form);
    } else {
      await membersApi.create(form);
    }
    setOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    if (window.confirm('このメンバーを削除しますか？')) {
      await membersApi.delete(id);
      load();
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
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}>
                      {m.name.charAt(0)}
                    </Avatar>
                    <Typography fontWeight="bold">{m.name}</Typography>
                  </Box>
                </TableCell>
                <TableCell>{m.email}</TableCell>
                <TableCell>{m.role ? <Chip label={m.role} size="small" /> : '-'}</TableCell>
                <TableCell>{m.department || '-'}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleOpen(m)}><EditIcon /></IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(m.id)}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {members.length === 0 && (
              <TableRow><TableCell colSpan={5} align="center">メンバーがいません</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'メンバー編集' : 'メンバー追加'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="名前 *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
          <TextField label="メールアドレス *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth />
          <TextField label="役職" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} fullWidth />
          <TextField label="部署" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name || !form.email}>保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
