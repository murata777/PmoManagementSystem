import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Chip, LinearProgress, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Grid, Divider, Checkbox, FormControlLabel, Tooltip, Select, FormControl, InputLabel
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import { projectsApi, tasksApi, customFieldsApi } from '../api';

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

const FIELD_TYPES = [
  { value: 'text', label: 'テキスト' },
  { value: 'number', label: '数値' },
  { value: 'date', label: '日付' },
  { value: 'checkbox', label: 'チェック' },
];

const EMPTY_FIELD = { field_key: '', field_type: 'text', field_value: '' };

// フィールドタイプに応じた値の入力コンポーネント
function FieldValueInput({ type, value, onChange, size = 'small' }) {
  if (type === 'checkbox') {
    return (
      <FormControlLabel
        control={<Checkbox checked={value === 'true'} onChange={e => onChange(e.target.checked ? 'true' : 'false')} size={size} />}
        label={value === 'true' ? 'ON' : 'OFF'}
      />
    );
  }
  return (
    <TextField
      type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      size={size}
      fullWidth
      InputLabelProps={type === 'date' ? { shrink: true } : undefined}
    />
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [fields, setFields] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_TASK);
  // カスタムフィールド用
  const [fieldDialog, setFieldDialog] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [fieldForm, setFieldForm] = useState(EMPTY_FIELD);
  const [inlineEditing, setInlineEditing] = useState({}); // fieldId -> value

  const load = () => {
    projectsApi.getById(id).then(res => {
      const { tasks: t, ...p } = res.data;
      setProject(p);
      setTasks(t || []);
    });
    customFieldsApi.getAll(id).then(res => setFields(res.data));
  };
  useEffect(() => { load(); }, [id]);

  // タスク操作
  const handleOpen = (task = null) => { setEditing(task); setForm(task ? { ...task } : EMPTY_TASK); setOpen(true); };
  const handleSave = async () => {
    editing ? await tasksApi.update(editing.id, form) : await tasksApi.create({ ...form, project_id: id });
    setOpen(false); load();
  };
  const handleDeleteTask = async (taskId) => {
    if (window.confirm('このタスクを削除しますか？')) { await tasksApi.delete(taskId); load(); }
  };

  // カスタムフィールド操作
  const handleOpenField = (field = null) => {
    setEditingField(field);
    setFieldForm(field ? { field_key: field.field_key, field_type: field.field_type, field_value: field.field_value || '' } : EMPTY_FIELD);
    setFieldDialog(true);
  };
  const handleSaveField = async () => {
    editingField
      ? await customFieldsApi.update(id, editingField.id, fieldForm)
      : await customFieldsApi.create(id, { ...fieldForm, sort_order: fields.length });
    setFieldDialog(false); load();
  };
  const handleDeleteField = async (fieldId) => {
    if (window.confirm('この項目を削除しますか？')) { await customFieldsApi.delete(id, fieldId); load(); }
  };

  // インライン値編集（値のみ即時保存）
  const handleInlineChange = (field, value) => {
    setInlineEditing(prev => ({ ...prev, [field.id]: value }));
  };
  const handleInlineSave = async (field) => {
    const value = inlineEditing[field.id] ?? field.field_value;
    await customFieldsApi.update(id, field.id, { ...field, field_value: value });
    setInlineEditing(prev => { const n = { ...prev }; delete n[field.id]; return n; });
    load();
  };

  if (!project) return null;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/projects')} sx={{ mb: 2 }}>一覧に戻る</Button>

      {/* プロジェクト概要 */}
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

      {/* カスタムフィールド */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">カスタム項目</Typography>
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => handleOpenField()}>項目追加</Button>
          </Box>
          {fields.length === 0 ? (
            <Typography variant="body2" color="text.secondary">カスタム項目がありません。「項目追加」から自由に項目を作成できます。</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '30%' }}>項目名</TableCell>
                  <TableCell sx={{ width: '15%' }}>タイプ</TableCell>
                  <TableCell>値</TableCell>
                  <TableCell align="right" sx={{ width: 100 }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {fields.map(f => {
                  const currentValue = inlineEditing[f.id] !== undefined ? inlineEditing[f.id] : (f.field_value || '');
                  const isDirty = inlineEditing[f.id] !== undefined && inlineEditing[f.id] !== (f.field_value || '');
                  return (
                    <TableRow key={f.id}>
                      <TableCell><Typography fontWeight="bold">{f.field_key}</Typography></TableCell>
                      <TableCell>
                        <Chip label={FIELD_TYPES.find(t => t.value === f.field_type)?.label || f.field_type} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ flexGrow: 1 }}>
                            <FieldValueInput
                              type={f.field_type}
                              value={currentValue}
                              onChange={val => handleInlineChange(f, val)}
                            />
                          </Box>
                          {isDirty && (
                            <Tooltip title="保存">
                              <IconButton size="small" color="primary" onClick={() => handleInlineSave(f)}>
                                <SaveIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleOpenField(f)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDeleteField(f.id)}><DeleteIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* タスク一覧 */}
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
            {tasks.map(t => (
              <TableRow key={t.id} hover>
                <TableCell>
                  <Typography fontWeight="bold">{t.title}</Typography>
                  {t.description && <Typography variant="caption" color="text.secondary">{t.description}</Typography>}
                </TableCell>
                <TableCell><Chip label={TASK_STATUS.find(s => s.value === t.status)?.label || t.status} color={TASK_STATUS_COLORS[t.status] || 'default'} size="small" /></TableCell>
                <TableCell><Chip label={PRIORITY_OPTIONS.find(s => s.value === t.priority)?.label || t.priority} color={PRIORITY_COLORS[t.priority] || 'default'} size="small" /></TableCell>
                <TableCell>{t.assignee || '-'}</TableCell>
                <TableCell>{t.due_date || '-'}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleOpen(t)}><EditIcon /></IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDeleteTask(t.id)}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
            {tasks.length === 0 && (
              <TableRow><TableCell colSpan={6} align="center">タスクがありません</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* タスクダイアログ */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'タスク編集' : 'タスク追加'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="タスク名 *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} fullWidth />
          <TextField label="説明" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} fullWidth multiline rows={2} />
          <TextField label="ステータス" select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} fullWidth>
            {TASK_STATUS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
          <TextField label="優先度" select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} fullWidth>
            {PRIORITY_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
          <TextField label="担当者" value={form.assignee} onChange={e => setForm({ ...form, assignee: e.target.value })} fullWidth />
          <TextField label="期日" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.title}>保存</Button>
        </DialogActions>
      </Dialog>

      {/* カスタムフィールドダイアログ（項目定義） */}
      <Dialog open={fieldDialog} onClose={() => setFieldDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingField ? 'カスタム項目を編集' : 'カスタム項目を追加'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="項目名 *"
            value={fieldForm.field_key}
            onChange={e => setFieldForm({ ...fieldForm, field_key: e.target.value })}
            fullWidth
            autoFocus
            placeholder="例: 予算、担当部署、完了フラグ"
          />
          <TextField
            label="タイプ"
            select
            value={fieldForm.field_type}
            onChange={e => setFieldForm({ ...fieldForm, field_type: e.target.value, field_value: '' })}
            fullWidth
          >
            {FIELD_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
          </TextField>
          <Box>
            <Typography variant="body2" gutterBottom color="text.secondary">初期値（省略可）</Typography>
            <FieldValueInput
              type={fieldForm.field_type}
              value={fieldForm.field_value}
              onChange={val => setFieldForm({ ...fieldForm, field_value: val })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFieldDialog(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleSaveField} disabled={!fieldForm.field_key}>保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
