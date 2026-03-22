import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardContent, TextField, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Divider, Chip,
  Avatar, List, ListItem, ListItemAvatar, ListItemText, Tooltip,
  Alert, Snackbar, Breadcrumbs, Link, Grid
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import SendIcon from '@mui/icons-material/Send';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, Legend, ReferenceLine, ResponsiveContainer
} from 'recharts';
import { projectsApi, progressApi, tasksApi } from '../api';

const formatDate = (dt) => {
  if (!dt) return '';
  let s = String(dt).replace(' ', 'T');
  if (!/Z|[+-]\d{2}:?\d{2}$/.test(s)) s += 'Z';
  const jst = new Date(new Date(s).getTime() + 9 * 3600 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${jst.getUTCFullYear()}/${pad(jst.getUTCMonth()+1)}/${pad(jst.getUTCDate())} ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
};

const calcEVM = (bac, pv, ev, ac) => {
  const n = (v) => (v !== null && v !== undefined && v !== '' ? Number(v) : null);
  const b = n(bac), p = n(pv), e = n(ev), a = n(ac);
  const spi = p ? e / p : null;
  const cpi = a ? e / a : null;
  const eac = cpi ? b / cpi : null;
  return {
    sv: (e !== null && p !== null) ? e - p : null,
    cv: (e !== null && a !== null) ? e - a : null,
    spi,
    cpi,
    eac,
    etc: (eac !== null && a !== null) ? eac - a : null,
    vac: (b !== null && eac !== null) ? b - eac : null,
  };
};

const indexColor = (v) => v === null ? 'default' : v >= 1.0 ? 'success' : v >= 0.9 ? 'warning' : 'error';
const varColor = (v) => v === null ? 'default' : v >= 0 ? 'success' : 'error';

const fmt = (v) => v === null || v === undefined ? '-' : Number(v).toLocaleString();
const fmtIdx = (v) => v === null || v === undefined ? '-' : Number(v).toFixed(2);

export default function ProgressTracking() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [records, setRecords] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  // 新規追加ダイアログ
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ record_date: '', bac: '', pv: '', ev: '', ac: '', evaluation: '' });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  // 編集状態
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ bac: '', pv: '', ev: '', ac: '' });

  // 評価コメント編集
  const [evalEditing, setEvalEditing] = useState({});

  // コメント入力
  const [commentInput, setCommentInput] = useState({});

  // タスク追加成功メッセージ
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) try { setCurrentUser(JSON.parse(u)); } catch {}
  }, []);

  const loadProject = () => {
    projectsApi.getById(id).then(res => {
      const { tasks: _t, ...p } = res.data;
      setProject(p);
    });
  };

  const loadRecords = () => {
    progressApi
      .getAll(id)
      .then((res) => {
        const data = res.data;
        setRecords(Array.isArray(data) ? data : []);
      })
      .catch(() => setRecords([]));
  };

  useEffect(() => {
    loadProject();
    loadRecords();
  }, [id]);

  // 新規作成
  const handleAdd = async () => {
    if (!addForm.record_date || !id) return;
    setAddError('');
    setAddSaving(true);
    try {
      await progressApi.create(id, {
        record_date: addForm.record_date,
        bac: addForm.bac,
        pv: addForm.pv,
        ev: addForm.ev,
        ac: addForm.ac,
        evaluation: addForm.evaluation,
      });
      setAddOpen(false);
      setAddForm({ record_date: '', bac: '', pv: '', ev: '', ac: '', evaluation: '' });
      loadRecords();
    } catch (e) {
      const msg = e.response?.data?.error || e.message || '保存に失敗しました';
      setAddError(msg);
    } finally {
      setAddSaving(false);
    }
  };

  // 削除
  const handleDelete = async (recordId) => {
    if (!window.confirm('この記録を削除しますか？')) return;
    await progressApi.delete(id, recordId);
    loadRecords();
  };

  // EVM値編集開始
  const handleEditStart = (record) => {
    setEditingId(record.id);
    setEditForm({ bac: record.bac ?? '', pv: record.pv ?? '', ev: record.ev ?? '', ac: record.ac ?? '' });
  };

  // EVM値保存
  const handleEditSave = async (record) => {
    await progressApi.update(id, record.id, {
      record_date: record.record_date,
      bac: editForm.bac,
      pv: editForm.pv,
      ev: editForm.ev,
      ac: editForm.ac,
      evaluation: record.evaluation,
    });
    setEditingId(null);
    loadRecords();
  };

  // 評価コメント保存
  const handleEvalSave = async (record) => {
    await progressApi.update(id, record.id, {
      record_date: record.record_date,
      bac: record.bac,
      pv: record.pv,
      ev: record.ev,
      ac: record.ac,
      evaluation: evalEditing[record.id] !== undefined ? evalEditing[record.id] : record.evaluation,
    });
    setEvalEditing(prev => { const n = { ...prev }; delete n[record.id]; return n; });
    loadRecords();
  };

  // コメント追加
  const handleAddComment = async (recordId) => {
    const text = (commentInput[recordId] || '').trim();
    if (!text) return;
    await progressApi.addComment(id, recordId, text);
    setCommentInput(prev => ({ ...prev, [recordId]: '' }));
    loadRecords();
  };

  // コメント削除
  const handleDeleteComment = async (recordId, commentId) => {
    await progressApi.deleteComment(id, recordId, commentId);
    loadRecords();
  };

  // タスクに追加
  const handleAddAsTask = async (comment) => {
    try {
      await tasksApi.create({
        project_id: id,
        title: comment.comment,
        description: '進捗確認コメントより追加',
        status: 'todo',
        priority: 'medium',
      });
      setSuccessMsg('タスクに追加しました');
    } catch (e) {
      setSuccessMsg('タスクの追加に失敗しました');
    }
  };

  // グラフ用データ（record_date ASC）
  const chartData = records.map(r => ({
    date: r.record_date,
    PV: r.pv !== null && r.pv !== undefined ? Number(r.pv) : null,
    EV: r.ev !== null && r.ev !== undefined ? Number(r.ev) : null,
    AC: r.ac !== null && r.ac !== undefined ? Number(r.ac) : null,
  }));
  const maxBac = records.reduce((m, r) => r.bac !== null && r.bac !== undefined ? Math.max(m, Number(r.bac)) : m, 0);

  // 表示は record_date DESC
  const sortedRecords = [...records].sort((a, b) => b.record_date.localeCompare(a.record_date));

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
          プロジェクト一覧
        </Link>
        <Link
          component="button"
          underline="hover"
          color="inherit"
          onClick={() => navigate(`/projects/${id}`)}
          sx={{ cursor: 'pointer' }}
        >
          {project.name}
        </Link>
        <Typography color="text.primary">進捗確認（EVM）</Typography>
      </Breadcrumbs>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">進捗確認（EVM）</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setAddError('');
            setAddOpen(true);
          }}
        >
          + 新規進捗記録
        </Button>
      </Box>

      {/* EVM推移グラフ */}
      {chartData.length >= 2 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>EVM推移グラフ</Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <ReTooltip />
                <Legend />
                {maxBac > 0 && (
                  <ReferenceLine y={maxBac} stroke="#9e9e9e" strokeDasharray="6 3" label={{ value: 'BAC', position: 'right', fill: '#9e9e9e' }} />
                )}
                <Line type="monotone" dataKey="PV" stroke="#1976d2" strokeWidth={2} dot={true} connectNulls />
                <Line type="monotone" dataKey="EV" stroke="#388e3c" strokeWidth={2} dot={true} connectNulls />
                <Line type="monotone" dataKey="AC" stroke="#d32f2f" strokeWidth={2} dot={true} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* 進捗記録リスト */}
      {sortedRecords.length === 0 ? (
        <Typography color="text.secondary">進捗記録がありません。「+ 新規進捗記録」から追加してください。</Typography>
      ) : (
        sortedRecords.map(record => {
          const comments = Array.isArray(record.comments) ? record.comments : [];
          const evm = calcEVM(record.bac, record.pv, record.ev, record.ac);
          const isEditing = editingId === record.id;
          const evalVal = evalEditing[record.id] !== undefined ? evalEditing[record.id] : (record.evaluation || '');
          const isEvalDirty = evalEditing[record.id] !== undefined && evalEditing[record.id] !== (record.evaluation || '');

          return (
            <Card key={record.id} sx={{ mb: 3 }}>
              <CardContent>
                {/* ヘッダー */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">{record.record_date}</Typography>
                  <IconButton color="error" size="small" onClick={() => handleDelete(record.id)}>
                    <DeleteIcon />
                  </IconButton>
                </Box>

                {/* EVM入力 */}
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" color="text.secondary">EVM入力値</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {isEditing ? (
                        <>
                          <Button size="small" variant="contained" startIcon={<SaveIcon />} onClick={() => handleEditSave(record)}>
                            保存
                          </Button>
                          <Button size="small" startIcon={<CancelIcon />} onClick={() => setEditingId(null)}>
                            キャンセル
                          </Button>
                        </>
                      ) : (
                        <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => handleEditStart(record)}>
                          編集
                        </Button>
                      )}
                    </Box>
                  </Box>
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <TextField
                        label="BAC"
                        type="number"
                        size="small"
                        fullWidth
                        value={isEditing ? editForm.bac : (record.bac ?? '')}
                        onChange={e => setEditForm(prev => ({ ...prev, bac: e.target.value }))}
                        InputProps={{ readOnly: !isEditing }}
                      />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField
                        label="PV"
                        type="number"
                        size="small"
                        fullWidth
                        value={isEditing ? editForm.pv : (record.pv ?? '')}
                        onChange={e => setEditForm(prev => ({ ...prev, pv: e.target.value }))}
                        InputProps={{ readOnly: !isEditing }}
                      />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField
                        label="EV"
                        type="number"
                        size="small"
                        fullWidth
                        value={isEditing ? editForm.ev : (record.ev ?? '')}
                        onChange={e => setEditForm(prev => ({ ...prev, ev: e.target.value }))}
                        InputProps={{ readOnly: !isEditing }}
                      />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField
                        label="AC"
                        type="number"
                        size="small"
                        fullWidth
                        value={isEditing ? editForm.ac : (record.ac ?? '')}
                        onChange={e => setEditForm(prev => ({ ...prev, ac: e.target.value }))}
                        InputProps={{ readOnly: !isEditing }}
                      />
                    </Grid>
                  </Grid>
                </Box>

                {/* EVM指標（計算値） */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>EVM指標</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    <Chip label={`SPI: ${fmtIdx(evm.spi)}`} color={indexColor(evm.spi)} size="small" />
                    <Chip label={`CPI: ${fmtIdx(evm.cpi)}`} color={indexColor(evm.cpi)} size="small" />
                    <Chip label={`SV: ${fmt(evm.sv)}`} color={varColor(evm.sv)} size="small" variant="outlined" />
                    <Chip label={`CV: ${fmt(evm.cv)}`} color={varColor(evm.cv)} size="small" variant="outlined" />
                    <Chip label={`EAC: ${fmt(evm.eac)}`} color="default" size="small" variant="outlined" />
                    <Chip label={`ETC: ${fmt(evm.etc)}`} color="default" size="small" variant="outlined" />
                    <Chip label={`VAC: ${fmt(evm.vac)}`} color={varColor(evm.vac)} size="small" variant="outlined" />
                  </Box>
                </Box>

                {/* 評価コメント */}
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>評価コメント</Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <TextField
                      multiline
                      minRows={2}
                      fullWidth
                      size="small"
                      placeholder="評価コメントを入力..."
                      value={evalVal}
                      onChange={e => setEvalEditing(prev => ({ ...prev, [record.id]: e.target.value }))}
                    />
                    {isEvalDirty && (
                      <Button variant="contained" size="small" onClick={() => handleEvalSave(record)} sx={{ mt: 0.5, whiteSpace: 'nowrap' }}>
                        保存
                      </Button>
                    )}
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* コメント */}
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    コメント ({comments.length}件)
                  </Typography>
                  {comments.length > 0 && (
                    <List dense disablePadding sx={{ mb: 1 }}>
                      {comments.map(c => (
                        <ListItem
                          key={c.id}
                          alignItems="flex-start"
                          disableGutters
                          sx={{ pr: 0 }}
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
                            secondary={
                              <Box>
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{c.comment}</Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                                  <Tooltip title="タスクに追加">
                                    <IconButton size="small" onClick={() => handleAddAsTask(c)}>
                                      <PlaylistAddIcon fontSize="small" color="primary" />
                                    </IconButton>
                                  </Tooltip>
                                  {currentUser && c.user_id === currentUser.id && (
                                    <Tooltip title="削除">
                                      <IconButton size="small" onClick={() => handleDeleteComment(record.id, c.id)}>
                                        <DeleteIcon fontSize="small" sx={{ color: 'error.light' }} />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </Box>
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}

                  {/* コメント入力 */}
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="コメントを入力..."
                      multiline
                      maxRows={4}
                      value={commentInput[record.id] || ''}
                      onChange={e => setCommentInput(prev => ({ ...prev, [record.id]: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAddComment(record.id);
                        }
                      }}
                    />
                    <IconButton
                      color="primary"
                      onClick={() => handleAddComment(record.id)}
                      disabled={!(commentInput[record.id] || '').trim()}
                    >
                      <SendIcon />
                    </IconButton>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* 新規追加ダイアログ */}
      <Dialog
        open={addOpen}
        onClose={() => !addSaving && setAddOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>新規進捗記録</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          {addError ? (
            <Alert severity="error" onClose={() => setAddError('')}>
              {addError}
            </Alert>
          ) : null}
          <TextField
            label="記録日 *"
            type="date"
            value={addForm.record_date}
            onChange={e => setAddForm(prev => ({ ...prev, record_date: e.target.value }))}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                label="BAC（完成時予算）"
                type="number"
                value={addForm.bac}
                onChange={e => setAddForm(prev => ({ ...prev, bac: e.target.value }))}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="PV（計画価値）"
                type="number"
                value={addForm.pv}
                onChange={e => setAddForm(prev => ({ ...prev, pv: e.target.value }))}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="EV（出来高）"
                type="number"
                value={addForm.ev}
                onChange={e => setAddForm(prev => ({ ...prev, ev: e.target.value }))}
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="AC（実際コスト）"
                type="number"
                value={addForm.ac}
                onChange={e => setAddForm(prev => ({ ...prev, ac: e.target.value }))}
                fullWidth
                size="small"
              />
            </Grid>
          </Grid>
          <TextField
            label="評価コメント"
            multiline
            rows={3}
            value={addForm.evaluation}
            onChange={e => setAddForm(prev => ({ ...prev, evaluation: e.target.value }))}
            fullWidth
            placeholder="この時点での評価・コメントを入力..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => !addSaving && setAddOpen(false)} disabled={addSaving}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={handleAdd}
            disabled={!addForm.record_date || addSaving}
          >
            {addSaving ? '保存中…' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* タスク追加成功メッセージ */}
      <Snackbar
        open={Boolean(successMsg)}
        autoHideDuration={2000}
        onClose={() => setSuccessMsg('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSuccessMsg('')} severity="success" sx={{ width: '100%' }}>
          {successMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
