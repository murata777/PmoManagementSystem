import { useEffect, useState, Fragment } from 'react';
import { useParams, useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { fmtEvmIndex, evmIndexChipColor } from '../utils/evm';
import {
  Box, Typography, Button, Chip, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Grid, Divider, Checkbox, FormControlLabel, Tooltip,
  Collapse, Avatar, List, ListItem, ListItemAvatar, ListItemText,
  Breadcrumbs, Link, Alert
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PersonIcon from '@mui/icons-material/Person';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { projectsApi, tasksApi, customFieldsApi, taskCommentsApi, membersApi } from '../api';
import CommentRichContent from '../components/CommentRichContent';
import PastedImagesPreview from '../components/PastedImagesPreview';
import {
  encodeCommentForStorage,
  tryConsumeClipboardImageAsDataUrl,
  MAX_PASTED_IMAGES_PER_COMMENT,
} from '../utils/commentImages';

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
  { value: 'link', label: 'リンク' },
];

const EMPTY_FIELD = { field_key: '', field_type: 'text', field_value: '' };

/** http(s) のみ。それ以外は null（javascript: 等を弾く） */
function safeExternalHref(raw) {
  const s = String(raw || '').trim();
  if (!/^https?:\/\//i.test(s)) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

function FieldValueInput({ type, value, onChange, size = 'small' }) {
  if (type === 'checkbox') {
    return (
      <FormControlLabel
        control={<Checkbox checked={value === 'true'} onChange={e => onChange(e.target.checked ? 'true' : 'false')} size={size} />}
        label={value === 'true' ? 'ON' : 'OFF'}
      />
    );
  }
  if (type === 'link') {
    const href = safeExternalHref(value);
    return (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, width: '100%' }}>
        <TextField
          type="url"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          size={size}
          fullWidth
          placeholder="https://example.com/..."
        />
        {href ? (
          <Tooltip title="新しいタブで開く">
            <IconButton
              size={size}
              component="a"
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ flexShrink: 0, mt: size === 'small' ? 0.5 : 1 }}
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
      </Box>
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

function taskStatusLabel(value) {
  return TASK_STATUS.find((s) => s.value === value)?.label || value || '—';
}

function TaskCommentPanel({ task, currentUser, onTaskUpdated, members }) {
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState('');
  const [pastedImages, setPastedImages] = useState([]);
  const [assignee, setAssignee] = useState(task.assignee || '');
  const [status, setStatus] = useState(task.status || 'todo');
  const [loading, setLoading] = useState(false);

  const loadComments = () => {
    taskCommentsApi.getAll(task.id).then(res => setComments(res.data));
  };

  useEffect(() => {
    loadComments();
    setAssignee(task.assignee || '');
    setStatus(task.status || 'todo');
  }, [task.id, task.assignee, task.status]);

  const assigneeChanged = assignee !== (task.assignee || '');
  const statusChanged = status !== (task.status || 'todo');
  const commentPayload = encodeCommentForStorage(input, pastedImages);
  const hasCommentBody = Boolean(commentPayload);
  const canSend = hasCommentBody || assigneeChanged || statusChanged;

  const handleSend = async () => {
    if (!canSend) return;
    setLoading(true);
    try {
      await taskCommentsApi.create(task.id, {
        comment: hasCommentBody ? commentPayload : undefined,
        new_assignee: assigneeChanged ? assignee : undefined,
        old_assignee: assigneeChanged ? (task.assignee || '') : undefined,
        // 常に送り、サーバーが DB の現在値と比較して tasks.status を更新する
        new_status: status,
      });
      setInput('');
      setPastedImages([]);
      loadComments();
      if (onTaskUpdated) onTaskUpdated();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (window.confirm('このコメントを削除しますか？')) {
      await taskCommentsApi.delete(task.id, commentId);
      loadComments();
    }
  };

  const formatDate = (dt) => {
    if (!dt) return '';
    // スペース区切りをTに正規化し、タイムゾーン情報がなければUTC(Z)として扱う
    let s = String(dt).replace(' ', 'T');
    if (!/Z|[+-]\d{2}:?\d{2}$/.test(s)) s += 'Z';
    const utcMs = new Date(s).getTime();
    if (isNaN(utcMs)) return String(dt);
    // UTC+9(JST)に手動変換
    const jst = new Date(utcMs + 9 * 3600 * 1000);
    const pad = n => String(n).padStart(2, '0');
    return `${jst.getUTCFullYear()}/${pad(jst.getUTCMonth()+1)}/${pad(jst.getUTCDate())} ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
  };

  return (
    <Box sx={{ px: 2, pb: 2, bgcolor: 'grey.50', borderTop: '1px solid', borderColor: 'divider' }}>
      <Typography variant="subtitle2" sx={{ pt: 1.5, mb: 1, color: 'text.secondary' }}>
        コメント・履歴 ({comments.length})
      </Typography>

      {comments.length > 0 && (
        <List dense disablePadding sx={{ mb: 1.5 }}>
          {comments.map(c => {
            if (c.comment_type === 'assignee_change') {
              return (
                <ListItem key={c.id} disableGutters sx={{ py: 0.3 }}>
                  <ListItemAvatar sx={{ minWidth: 32 }}>
                    <Avatar sx={{ width: 24, height: 24, bgcolor: 'info.light' }}>
                      <PersonIcon sx={{ fontSize: 14 }} />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="caption" fontWeight="bold">{c.user_name}</Typography>
                        <Typography variant="caption" color="text.secondary">が担当者を変更:</Typography>
                        {c.old_assignee
                          ? <Chip label={c.old_assignee} size="small" variant="outlined" sx={{ height: 18, fontSize: 11 }} />
                          : <Typography variant="caption" color="text.secondary">（未設定）</Typography>
                        }
                        <Typography variant="caption" color="text.secondary">→</Typography>
                        {c.new_assignee
                          ? <Chip label={c.new_assignee} size="small" color="primary" sx={{ height: 18, fontSize: 11 }} />
                          : <Typography variant="caption" color="text.secondary">（未設定）</Typography>
                        }
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>{formatDate(c.created_at)}</Typography>
                      </Box>
                    }
                  />
                </ListItem>
              );
            }
            if (c.comment_type === 'status_change') {
              return (
                <ListItem key={c.id} disableGutters sx={{ py: 0.3 }}>
                  <ListItemAvatar sx={{ minWidth: 32 }}>
                    <Avatar sx={{ width: 24, height: 24, bgcolor: 'secondary.light' }}>
                      <SwapHorizIcon sx={{ fontSize: 14 }} />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="caption" fontWeight="bold">{c.user_name}</Typography>
                        <Typography variant="caption" color="text.secondary">がステータスを変更:</Typography>
                        <Chip
                          label={taskStatusLabel(c.old_status)}
                          size="small"
                          variant="outlined"
                          sx={{ height: 18, fontSize: 11 }}
                        />
                        <Typography variant="caption" color="text.secondary">→</Typography>
                        <Chip
                          label={taskStatusLabel(c.new_status)}
                          size="small"
                          color={TASK_STATUS_COLORS[c.new_status] || 'default'}
                          sx={{ height: 18, fontSize: 11 }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>{formatDate(c.created_at)}</Typography>
                      </Box>
                    }
                  />
                </ListItem>
              );
            }
            return (
              <ListItem key={c.id} alignItems="flex-start" disableGutters
                secondaryAction={
                  currentUser && c.user_id === currentUser.id &&
                  <IconButton size="small" edge="end" onClick={() => handleDelete(c.id)}>
                    <DeleteIcon fontSize="small" sx={{ color: 'error.light' }} />
                  </IconButton>
                }
                sx={{ pr: currentUser && c.user_id === currentUser.id ? 4 : 0 }}
              >
                <ListItemAvatar sx={{ minWidth: 36 }}>
                  <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>{c.user_name?.charAt(0)}</Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
                      <Typography variant="caption" fontWeight="bold">{c.user_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{formatDate(c.created_at)}</Typography>
                    </Box>
                  }
                  secondaryTypographyProps={{ component: 'div' }}
                  secondary={<CommentRichContent value={c.comment} />}
                />
              </ListItem>
            );
          })}
        </List>
      )}

      {/* 入力エリア */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <PersonIcon fontSize="small" color="action" />
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 50 }}>担当者:</Typography>
          <TextField
            select
            size="small"
            value={assignee}
            onChange={e => setAssignee(e.target.value)}
            sx={{ width: 200, ...(assigneeChanged ? { '& fieldset': { borderColor: 'warning.main' } } : {}) }}
          >
            <MenuItem value="">（未設定）</MenuItem>
            {(members || []).map(m => (
              <MenuItem key={m.id} value={m.name}>{m.name}</MenuItem>
            ))}
          </TextField>
          {assigneeChanged && (
            <Typography variant="caption" color="warning.dark">変更あり</Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <SwapHorizIcon fontSize="small" color="action" />
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 50 }}>ステータス:</Typography>
          <TextField
            select
            size="small"
            value={status}
            onChange={e => setStatus(e.target.value)}
            sx={{ width: 180, ...(statusChanged ? { '& fieldset': { borderColor: 'warning.main' } } : {}) }}
          >
            {TASK_STATUS.map(o => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
          {statusChanged && (
            <Typography variant="caption" color="warning.dark">変更あり</Typography>
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          クリップボードの画面キャプチャをこの欄に貼り付け（Ctrl+V）できます。最大 {MAX_PASTED_IMAGES_PER_COMMENT} 枚。
        </Typography>
        <PastedImagesPreview
          images={pastedImages}
          max={MAX_PASTED_IMAGES_PER_COMMENT}
          onRemove={(index) => setPastedImages((prev) => prev.filter((_, i) => i !== index))}
        />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="コメントを入力... (Shift+Enterで送信、画像は貼り付け)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onPaste={async (e) => {
              const url = await tryConsumeClipboardImageAsDataUrl(e.clipboardData);
              if (url) {
                e.preventDefault();
                setPastedImages((prev) =>
                  prev.length >= MAX_PASTED_IMAGES_PER_COMMENT ? prev : [...prev, url]
                );
              }
            }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            multiline
            maxRows={4}
          />
          <Tooltip
            title={
              !input.trim() && (assigneeChanged || statusChanged)
                ? '担当者・ステータス変更を保存'
                : 'コメントを投稿'
            }
          >
            <span>
              <IconButton color="primary" onClick={handleSend} disabled={loading || !canSend}>
                <SendIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
}

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [fields, setFields] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_TASK);
  const [fieldDialog, setFieldDialog] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [fieldForm, setFieldForm] = useState(EMPTY_FIELD);
  const [inlineEditing, setInlineEditing] = useState({});
  const [expandedTask, setExpandedTask] = useState(null); // taskId or null
  const [currentUser, setCurrentUser] = useState(null);
  const [members, setMembers] = useState([]);
  const [dupOpen, setDupOpen] = useState(false);
  const [dupName, setDupName] = useState('');
  const [dupSaving, setDupSaving] = useState(false);
  const [dupError, setDupError] = useState('');

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) try { setCurrentUser(JSON.parse(u)); } catch {}
    membersApi.getAll().then(res => setMembers(res.data));
  }, []);

  const load = () => {
    projectsApi.getById(id).then(res => {
      const { tasks: t, ...p } = res.data;
      setProject(p);
      setTasks(t || []);
    });
    customFieldsApi.getAll(id).then(res => setFields(res.data));
  };
  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    const hash = location.hash || '';
    if (!hash.startsWith('#task-') || !tasks.length) return undefined;
    const taskId = decodeURIComponent(hash.slice('#task-'.length));
    if (!tasks.some((t) => t.id === taskId)) return undefined;
    setExpandedTask(taskId);
    const raf = requestAnimationFrame(() => {
      document.getElementById(`task-row-${taskId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => cancelAnimationFrame(raf);
  }, [location.hash, tasks]);

  const handleOpen = (task = null) => { setEditing(task); setForm(task ? { ...task } : EMPTY_TASK); setOpen(true); };
  const handleSave = async () => {
    editing ? await tasksApi.update(editing.id, form) : await tasksApi.create({ ...form, project_id: id });
    setOpen(false); load();
  };
  const handleDeleteTask = async (taskId) => {
    if (window.confirm('このタスクを削除しますか？')) { await tasksApi.delete(taskId); load(); }
  };

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

  const handleInlineChange = (field, value) => {
    setInlineEditing(prev => ({ ...prev, [field.id]: value }));
  };
  const handleInlineSave = async (field) => {
    const value = inlineEditing[field.id] ?? field.field_value;
    await customFieldsApi.update(id, field.id, { ...field, field_value: value });
    setInlineEditing(prev => { const n = { ...prev }; delete n[field.id]; return n; });
    load();
  };

  const toggleComments = (taskId) => {
    setExpandedTask(prev => prev === taskId ? null : taskId);
  };

  const openDuplicateDialog = () => {
    if (!project) return;
    setDupName(`${project.name}（コピー）`);
    setDupError('');
    setDupOpen(true);
  };

  const handleDuplicateProject = async () => {
    if (!dupName.trim()) return;
    setDupSaving(true);
    setDupError('');
    try {
      const res = await projectsApi.duplicate(id, { name: dupName.trim() });
      setDupOpen(false);
      navigate(`/projects/${res.data.id}`);
    } catch (err) {
      setDupError(err.response?.data?.error || '複製に失敗しました');
    } finally {
      setDupSaving(false);
    }
  };

  if (!project) return null;

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          underline="hover"
          color="inherit"
          onClick={() => navigate('/projects')}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
        >
          <ArrowBackIcon fontSize="small" />
          プロジェクト一覧
        </Link>
        <Typography color="text.primary">{project.name}</Typography>
      </Breadcrumbs>

      <Button variant="outlined" startIcon={<AssignmentIcon />} onClick={() => navigate(`/projects/${id}/phase-gates`)} sx={{ mb: 2, ml: 1 }}>
        フェーズゲート
      </Button>
      <Button variant="outlined" startIcon={<TrendingUpIcon />} onClick={() => navigate(`/projects/${id}/progress`)} sx={{ mb: 2, ml: 1 }}>
        進捗確認（EVM）
      </Button>
      <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={openDuplicateDialog} sx={{ mb: 2, ml: 1 }}>
        プロジェクトを複製
      </Button>

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
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              進捗状況（進捗確認 EVM の最新記録）
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <Chip
                label={`SPI ${fmtEvmIndex(project.evm_spi)}`}
                color={evmIndexChipColor(project.evm_spi)}
                size="small"
                variant={project.evm_spi == null ? 'outlined' : 'filled'}
              />
              <Chip
                label={`CPI ${fmtEvmIndex(project.evm_cpi)}`}
                color={evmIndexChipColor(project.evm_cpi)}
                size="small"
                variant={project.evm_cpi == null ? 'outlined' : 'filled'}
              />
              {project.evm_as_of && (
                <Typography variant="body2" color="text.secondary">
                  基準日 {project.evm_as_of}
                </Typography>
              )}
            </Box>
            {!project.evm_as_of && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                まだ進捗記録がありません。{' '}
                <Link component={RouterLink} to={`/projects/${id}/progress`} color="inherit" sx={{ fontWeight: 600 }}>
                  進捗確認（EVM）
                </Link>
                から入力してください。
              </Typography>
            )}
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
              <Fragment key={t.id}>
                <TableRow
                  id={`task-row-${t.id}`}
                  hover
                  sx={{ cursor: 'pointer', '& td': { borderBottom: expandedTask === t.id ? 0 : undefined } }}
                  onClick={() => toggleComments(t.id)}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {expandedTask === t.id ? <ExpandLessIcon fontSize="small" color="action" /> : <ExpandMoreIcon fontSize="small" color="action" />}
                      <Box>
                        <Typography fontWeight="bold">{t.title}</Typography>
                        {t.description && <Typography variant="caption" color="text.secondary" display="block">{t.description}</Typography>}
                        {(t.progress_comment_id || t.progress_record_id) && (
                          <Link
                            component={RouterLink}
                            to={`/projects/${id}/progress#${
                              t.progress_comment_id
                                ? `evm-comment-${t.progress_comment_id}`
                                : `evm-eval-${t.progress_record_id}`
                            }`}
                            variant="caption"
                            sx={{ display: 'inline-block', mt: 0.25 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            進捗確認（EVM）のコメント／記録へ
                          </Link>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Chip label={TASK_STATUS.find(s => s.value === t.status)?.label || t.status} color={TASK_STATUS_COLORS[t.status] || 'default'} size="small" />
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Chip label={PRIORITY_OPTIONS.find(s => s.value === t.priority)?.label || t.priority} color={PRIORITY_COLORS[t.priority] || 'default'} size="small" />
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>{t.assignee || '-'}</TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>{t.due_date || '-'}</TableCell>
                  <TableCell align="right" onClick={e => e.stopPropagation()}>
                    <IconButton size="small" onClick={() => handleOpen(t)}><EditIcon /></IconButton>
                    <IconButton size="small" color="error" onClick={() => handleDeleteTask(t.id)}><DeleteIcon /></IconButton>
                  </TableCell>
                </TableRow>
                {expandedTask === t.id && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ p: 0 }}>
                      <TaskCommentPanel task={t} currentUser={currentUser} onTaskUpdated={load} members={members} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
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
          <TextField label="担当者" select value={form.assignee || ''} onChange={e => setForm({ ...form, assignee: e.target.value })} fullWidth>
            <MenuItem value="">（未設定）</MenuItem>
            {members.map(m => <MenuItem key={m.id} value={m.name}>{m.name}</MenuItem>)}
          </TextField>
          <TextField label="期日" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.title}>保存</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dupOpen} onClose={() => !dupSaving && setDupOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>プロジェクトを複製</DialogTitle>
        <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {dupError ? <Alert severity="error" onClose={() => setDupError('')}>{dupError}</Alert> : null}
          <Typography variant="body2" color="text.secondary">
            説明・ステータス・優先度・期間・担当PM・グループ・プロセスタイプとカスタム項目を引き継ぎます。タスク・フェーズゲート・進捗記録は複製しません。
          </Typography>
          <TextField label="新しいプロジェクト名 *" value={dupName} onChange={(e) => setDupName(e.target.value)} fullWidth autoFocus />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDupOpen(false)} disabled={dupSaving}>キャンセル</Button>
          <Button variant="contained" onClick={handleDuplicateProject} disabled={!dupName.trim() || dupSaving}>
            {dupSaving ? '複製中…' : '複製'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* カスタムフィールドダイアログ */}
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
