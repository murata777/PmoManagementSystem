import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Chip, LinearProgress, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Grid
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { projectsApi, tasksApi } from '../api';

const TASK_STATUS = [
  { value: 'todo', label: '未着手' },
  { value: 'inprogress', label: '進行中' },
  { value: 'review', label: 'レビュー中' },
  { value: 'done', label: '完了' },
];
const PRIORITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
];
const TASK_STATUS_COLORS = { todo: 'default', inprogress: 'info', review: 'warning', done: 'success' };
const PRIORITY_COLORS = { low: 'default', medium: 'primary', high: 'error' };

const EMPTY_TASK = { title: '', description: '', status: 'todo', priority: 'medium', assignee: '', due_date: '' };

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_TASK);

  const load = () => {
    projectsApi.getById(id).then((res) => {
      const { tasks: t, ...p } = res.data;
      setProject(p);
      setTasks(t || []);
    });
  };
  useEffect(() => { load(); }, [id]);

  const handleOpen = (task = null) => {
    setEditing(task);
    setForm(task ? { ...task } : EMPTY_TASK);
    setOpen(true);
  };

  const handleSave = async () => {
    if (editing) {
      await tasksApi.update(editing.id, form);
    } else {
      await tasksApi.create({ ...form, project_id: id });
    }
    setOpen(false);
    load();
  };

  const handleDelete = async (taskId) => {
    if (window.confirm('このタスクを削除しますか？')) {
      await tasksApi.delete(taskId);
      load();
    }
  };

  if (!project) return null;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/projects')} sx={{ mb: 2 }}>一覧に戻る</Button>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <Typography variant="h5">{project.name}</Typography>
              {project.description && <Typography color="text.secondary" sx={{ mt: 1 }}>{project.description}</Typography>}
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: { md: 'flex-end' } }}>
                <Chip label={project.status} color="primary" />
                <Chip label={`優先度: ${project.priority}`} variant="outlined" />
              </Box>
            </Grid>
          </Grid>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>進捗: {project.progress || 0}%</Typography>
            <LinearProgress variant="determinate" value={project.progress || 0} sx={{ height: 10, borderRadius: 5 }} />
          </Box>
          {project.manager && <Typography variant="body2" sx={{ mt: 1 }}>担当PM: {project.manager}</Typography>}
          {project.start_date && project.end_date && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>期間: {project.start_date} ～ {project.end_date}</Typography>
          )}
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">タスク一覧</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>タスク追加</Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>タスク名</TableCell>
              <TableCell>ステータス</TableCell>
              <TableCell>優先度</TableCell>
              <TableCell>担当者</TableCell>
              <TableCell>期日</TableCell>
              <TableCell align="right">操作</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tasks.map((t) => (
              <TableRow key={t.id} hover>
                <TableCell><Typography fontWeight="bold">{t.title}</Typography>{t.description && <Typography variant="caption" color="text.secondary">{t.description}</Typography>}</TableCell>
                <TableCell><Chip label={TASK_STATUS.find(s => s.value === t.status)?.label || t.status} color={TASK_STATUS_COLORS[t.status] || 'default'} size="small" /></TableCell>
                <TableCell><Chip label={PRIORITY_OPTIONS.find(s => s.value === t.priority)?.label || t.priority} color={PRIORITY_COLORS[t.priority] || 'default'} size="small" /></TableCell>
                <TableCell>{t.assignee || '-'}</TableCell>
                <TableCell>{t.due_date || '-'}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleOpen(t)}><EditIcon /></IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(t.id)}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {tasks.length === 0 && (
              <TableRow><TableCell colSpan={6} align="center">タスクがありません</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'タスク編集' : 'タスク追加'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="タスク名 *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} fullWidth />
          <TextField label="説明" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} fullWidth multiline rows={2} />
          <TextField label="ステータス" select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} fullWidth>
            {TASK_STATUS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
          <TextField label="優先度" select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} fullWidth>
            {PRIORITY_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
          <TextField label="担当者" value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })} fullWidth />
          <TextField label="期日" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.title}>保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
