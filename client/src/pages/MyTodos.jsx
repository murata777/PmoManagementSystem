import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  List,
  ListItem,
  Checkbox,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  MenuItem,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import AddIcon from '@mui/icons-material/Add';
import { myTodosApi } from '../api';
import CommentRichContent from '../components/CommentRichContent.jsx';
import PastedImagesPreview from '../components/PastedImagesPreview.jsx';
import {
  decodeCommentStored,
  encodeCommentForStorage,
  MAX_PASTED_IMAGES_PER_COMMENT,
  tryConsumeClipboardImageAsDataUrl,
} from '../utils/commentImages';

function formatDue(s) {
  if (!s) return '';
  const d = String(s).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(y, m - 1, day);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('ja-JP');
}

function isDuePast(due) {
  if (!due || String(due).length < 10) return false;
  const s = String(due).slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  const end = new Date(y, m - 1, d);
  end.setHours(23, 59, 59, 999);
  return end < new Date();
}

function normalizeSearch(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function hasDueDate(row) {
  const s = row.due_date ? String(row.due_date).slice(0, 10) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function hasMemoContent(row) {
  const { text, images } = decodeCommentStored(row.notes || '');
  return Boolean(String(text || '').trim()) || images.length > 0;
}

/** 空白区切りの各語がタイトルまたはメモに含まれるか（AND） */
function matchesKeyword(row, qRaw) {
  const q = normalizeSearch(qRaw);
  if (!q) return true;
  const terms = q.split(' ').filter(Boolean);
  if (terms.length === 0) return true;
  const { text, images } = decodeCommentStored(row.notes || '');
  const blob = normalizeSearch([row.title, text, images.length ? '画像' : ''].join(' '));
  return terms.every((t) => blob.includes(t));
}

function matchesDueFilter(row, dueFilter) {
  if (dueFilter === 'all') return true;
  if (dueFilter === 'has_due') return hasDueDate(row);
  if (dueFilter === 'no_due') return !hasDueDate(row);
  if (dueFilter === 'overdue') return !row.completed && isDuePast(row.due_date);
  return true;
}

export default function MyTodos() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [dueFilter, setDueFilter] = useState('all');
  const [newTitle, setNewTitle] = useState('');
  const [newDue, setNewDue] = useState('');
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ id: '', title: '', notes: '', due_date: '' });
  const [editPastedImages, setEditPastedImages] = useState([]);

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await myTodosApi.getAll();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.response?.data?.error || e.message || '読み込みに失敗しました');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const f = searchParams.get('filter');
    if (f === 'active' || f === 'done' || f === 'all') setFilter(f);
  }, [searchParams]);

  useEffect(() => {
    const raw = location.hash?.replace(/^#/, '');
    if (!raw || !raw.startsWith('todo-')) return;
    const todoId = decodeURIComponent(raw.slice('todo-'.length));
    if (!todoId) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(`todo-${todoId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [location.hash, items, loading]);

  const statusFiltered = useMemo(() => {
    if (filter === 'active') return items.filter((i) => !i.completed);
    if (filter === 'done') return items.filter((i) => i.completed);
    return items;
  }, [items, filter]);

  const filtered = useMemo(() => {
    return statusFiltered.filter((row) => matchesKeyword(row, searchText) && matchesDueFilter(row, dueFilter));
  }, [statusFiltered, searchText, dueFilter]);

  const canReorder = filter === 'all' && !normalizeSearch(searchText) && dueFilter === 'all';

  const activeCount = useMemo(() => items.filter((i) => !i.completed).length, [items]);
  const doneCount = useMemo(() => items.filter((i) => i.completed).length, [items]);

  const handleAdd = async () => {
    const t = newTitle.trim();
    if (!t) return;
    setSaving(true);
    setError('');
    try {
      await myTodosApi.create({
        title: t,
        due_date: newDue.trim() || undefined,
      });
      setNewTitle('');
      setNewDue('');
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message || '追加に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const toggleComplete = async (row) => {
    try {
      await myTodosApi.update(row.id, { completed: !row.completed });
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message || '更新に失敗しました');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('この ToDo を削除しますか？')) return;
    try {
      await myTodosApi.delete(id);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message || '削除に失敗しました');
    }
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditPastedImages([]);
  };

  const openEdit = (row) => {
    const { text, images } = decodeCommentStored(row.notes || '');
    setEditForm({
      id: row.id,
      title: row.title || '',
      notes: text,
      due_date: row.due_date ? String(row.due_date).slice(0, 10) : '',
    });
    setEditPastedImages(images.length ? [...images] : []);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    const t = editForm.title.trim();
    if (!t) return;
    const notesStored = encodeCommentForStorage(editForm.notes, editPastedImages);
    try {
      await myTodosApi.update(editForm.id, {
        title: t,
        notes: notesStored || null,
        due_date: editForm.due_date || null,
      });
      closeEdit();
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message || '保存に失敗しました');
    }
  };

  const applyReorder = async (nextIds) => {
    try {
      await myTodosApi.reorder(nextIds);
      await load();
    } catch (e) {
      setError(e.response?.data?.error || e.message || '並べ替えに失敗しました');
      await load();
    }
  };

  const handleDropBefore = (targetId, e) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('text/plain');
    setDragId(null);
    setOverId(null);
    if (!draggedId || draggedId === targetId || !canReorder) return;
    const without = items.filter((x) => x.id !== draggedId);
    const targetIdx = without.findIndex((x) => x.id === targetId);
    const dragged = items.find((x) => x.id === draggedId);
    if (!dragged || targetIdx < 0) return;
    const next = [...without.slice(0, targetIdx), dragged, ...without.slice(targetIdx)];
    let seenDone = false;
    for (const x of next) {
      if (x.completed) seenDone = true;
      else if (seenDone) return;
    }
    applyReorder(next.map((x) => x.id));
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
      <Typography variant="h5" gutterBottom>
        マイToDo
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        あなた本人だけが見られるメモ用の ToDo です。プロジェクトのタスクとは別に管理されます。
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      ) : null}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            新規追加
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}>
            <TextField
              size="small"
              label="タイトル"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              sx={{ flex: '1 1 220px', minWidth: 200 }}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAdd()}
            />
            <TextField
              size="small"
              label="期日"
              type="date"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 160 }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAdd}
              disabled={saving || !newTitle.trim()}
            >
              追加
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Tabs value={filter} onChange={(_, v) => setFilter(v)} sx={{ mb: 2 }}>
            <Tab label={`すべて (${items.length})`} value="all" />
            <Tab label={`未完了 (${activeCount})`} value="active" />
            <Tab label={`完了 (${doneCount})`} value="done" />
          </Tabs>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2, alignItems: 'flex-end' }}>
            <TextField
              size="small"
              label="キーワード"
              placeholder="タイトル・メモ（空白で AND）"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              sx={{ flex: '1 1 220px', minWidth: 200 }}
            />
            <TextField
              select
              size="small"
              label="期日"
              value={dueFilter}
              onChange={(e) => setDueFilter(e.target.value)}
              sx={{ width: 220 }}
            >
              <MenuItem value="all">すべて</MenuItem>
              <MenuItem value="has_due">期日あり</MenuItem>
              <MenuItem value="no_due">期日なし</MenuItem>
              <MenuItem value="overdue">期限切れ（未完了）</MenuItem>
            </TextField>
            {normalizeSearch(searchText) || dueFilter !== 'all' ? (
              <Button size="small" onClick={() => { setSearchText(''); setDueFilter('all'); }}>
                条件をクリア
              </Button>
            ) : null}
          </Box>

          {(normalizeSearch(searchText) || dueFilter !== 'all') && statusFiltered.length > 0 ? (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              {filtered.length} / {statusFiltered.length} 件を表示
            </Typography>
          ) : null}

          {canReorder ? (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              左の ≡ をドラッグして、未完了同士・完了同士の順序を入れ替えられます（未完了は常に完了より上です）。
            </Typography>
          ) : filter === 'all' ? (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              キーワードまたは期日で絞り込み中は並べ替えできません。
            </Typography>
          ) : null}

          {filtered.length === 0 ? (
            <Typography color="text.secondary">
              {items.length === 0
                ? 'ToDo はまだありません。'
                : statusFiltered.length === 0
                  ? '該当する ToDo はありません。'
                  : '条件に一致する ToDo はありません。'}
            </Typography>
          ) : (
            <List dense disablePadding>
              {filtered.map((row, i) => {
                const past = !row.completed && isDuePast(row.due_date);
                const isOver = overId === row.id && dragId && dragId !== row.id && canReorder;
                return (
                  <Box key={row.id} id={`todo-${row.id}`}>
                    {i > 0 ? <Divider component="li" /> : null}
                    <ListItem
                      alignItems="flex-start"
                      sx={{
                        py: 1,
                        pl: 0,
                        pr: 0,
                        borderTop: isOver ? 2 : 0,
                        borderColor: 'primary.main',
                        opacity: dragId === row.id ? 0.5 : 1,
                      }}
                      secondaryAction={
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <IconButton edge="end" size="small" aria-label="編集" onClick={() => openEdit(row)}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton edge="end" size="small" aria-label="削除" onClick={() => handleDelete(row.id)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      }
                      onDragOver={
                        canReorder
                          ? (e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'move';
                              if (dragId && dragId !== row.id) setOverId(row.id);
                            }
                          : undefined
                      }
                      onDragLeave={
                        canReorder
                          ? () => setOverId((cur) => (cur === row.id ? null : cur))
                          : undefined
                      }
                      onDrop={canReorder ? (e) => handleDropBefore(row.id, e) : undefined}
                    >
                      {canReorder ? (
                        <Box
                          component="span"
                          draggable
                          onDragStart={(e) => {
                            setDragId(row.id);
                            e.dataTransfer.setData('text/plain', row.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => {
                            setDragId(null);
                            setOverId(null);
                          }}
                          sx={{
                            cursor: 'grab',
                            display: 'inline-flex',
                            mr: 0.5,
                            mt: 0.5,
                            color: 'text.secondary',
                            touchAction: 'none',
                          }}
                        >
                          <DragIndicatorIcon fontSize="small" />
                        </Box>
                      ) : null}
                      <Checkbox
                        edge="start"
                        checked={Boolean(row.completed)}
                        tabIndex={-1}
                        onChange={() => toggleComplete(row)}
                        sx={{ mt: -0.5 }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0, mr: 6 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            textDecoration: row.completed ? 'line-through' : 'none',
                            color: row.completed ? 'text.secondary' : 'text.primary',
                          }}
                        >
                          {row.title}
                        </Typography>
                        {hasMemoContent(row) ? (
                          <CommentRichContent
                            value={row.notes}
                            sx={{
                              mt: 0.5,
                              color: 'text.secondary',
                              '& .MuiTypography-root': { fontSize: '0.8125rem' },
                            }}
                          />
                        ) : null}
                        <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {row.due_date ? (
                            <Chip
                              size="small"
                              label={`期日 ${formatDue(row.due_date)}`}
                              color={past ? 'error' : 'default'}
                              variant={past ? 'filled' : 'outlined'}
                            />
                          ) : null}
                        </Box>
                      </Box>
                    </ListItem>
                  </Box>
                );
              })}
            </List>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onClose={closeEdit} maxWidth="sm" fullWidth>
        <DialogTitle>ToDo を編集</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="タイトル"
            value={editForm.title}
            onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
            fullWidth
            autoFocus
          />
          <Typography variant="caption" color="text.secondary" display="block">
            メモ欄に画面キャプチャを貼り付け（Ctrl+V）できます。最大 {MAX_PASTED_IMAGES_PER_COMMENT} 枚。
          </Typography>
          <PastedImagesPreview
            images={editPastedImages}
            max={MAX_PASTED_IMAGES_PER_COMMENT}
            onRemove={(index) => setEditPastedImages((prev) => prev.filter((_, i) => i !== index))}
          />
          <TextField
            label="メモ"
            value={editForm.notes}
            onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
            onPaste={async (e) => {
              const url = await tryConsumeClipboardImageAsDataUrl(e.clipboardData);
              if (url) {
                e.preventDefault();
                setEditPastedImages((prev) =>
                  prev.length >= MAX_PASTED_IMAGES_PER_COMMENT ? prev : [...prev, url]
                );
              }
            }}
            fullWidth
            multiline
            minRows={3}
            placeholder="テキストや画像（貼り付け）でメモを入力"
          />
          <TextField
            label="期日"
            type="date"
            value={editForm.due_date}
            onChange={(e) => setEditForm((f) => ({ ...f, due_date: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit}>キャンセル</Button>
          <Button variant="contained" onClick={saveEdit} disabled={!editForm.title.trim()}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
