import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardContent, TextField, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Divider, Chip,
  Avatar, List, ListItem, ListItemAvatar, ListItemText, Tooltip, MenuItem,
  Alert, Snackbar, Breadcrumbs, Link, Grid, useTheme
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import SendIcon from '@mui/icons-material/Send';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import ThunderstormIcon from '@mui/icons-material/Thunderstorm';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, Legend, ReferenceLine, ResponsiveContainer,
  BarChart, Bar, Cell, LabelList
} from 'recharts';
import { projectsApi, progressApi, tasksApi } from '../api';
import CommentRichContent from '../components/CommentRichContent';
import PastedImagesPreview from '../components/PastedImagesPreview';
import {
  encodeCommentForStorage,
  decodeCommentStored,
  tryConsumeClipboardImageAsDataUrl,
  plainTextForTaskTitleFromDraft,
  MAX_PASTED_IMAGES_PER_COMMENT,
} from '../utils/commentImages';

function evaluationsEquivalent(stored, textOverride, imgsOverride) {
  const d = decodeCommentStored(stored || '');
  const t = textOverride !== undefined ? textOverride : d.text;
  const imgs = imgsOverride !== undefined ? imgsOverride : d.images;
  return d.text === t && JSON.stringify(d.images) === JSON.stringify(imgs);
}

function getEvalText(record, evalEditing) {
  return evalEditing[record.id] !== undefined ? evalEditing[record.id] : decodeCommentStored(record.evaluation || '').text;
}

function getEvalImages(record, evalPastedImages) {
  return evalPastedImages[record.id] !== undefined
    ? evalPastedImages[record.id]
    : decodeCommentStored(record.evaluation || '').images;
}

const TASK_STATUS = [
  { value: 'todo', label: '未着手' },
  { value: 'inprogress', label: '進行中' },
  { value: 'review', label: 'レビュー中' },
  { value: 'done', label: '完了' },
];
const TASK_STATUS_COLORS = { todo: 'default', inprogress: 'info', review: 'warning', done: 'success' };
const LINK_TYPE_OPTIONS = [
  { value: 'url', label: 'URL' },
  { value: 'file', label: 'ファイルパス' },
];
const emptyLink = () => ({ id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: 'url', value: '', label: '' });

const normalizeLinks = (links) => {
  let source = links;
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source);
    } catch {
      source = [];
    }
  }
  const arr = Array.isArray(source)
    ? source
    : (source && typeof source === 'object' && (source.type || source.value || source.label))
      ? [source]
      : [];
  return arr.map((l) => ({
    id: l?.id || `tmp-${Math.random().toString(36).slice(2, 7)}`,
    type: l?.type === 'file' ? 'file' : 'url',
    value: String(l?.value || ''),
    label: String(l?.label || ''),
  }));
};

const sanitizeLinksForSave = (links) =>
  normalizeLinks(links)
    .map((l) => ({ ...l, value: l.value.trim(), label: l.label.trim() }))
    .filter((l) => l.value !== '');

const toLinkHref = (item) => {
  if (!item?.value) return '#';
  if (item.type === 'url') {
    const v = String(item.value).trim();
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  }
  const normalized = String(item.value).replace(/\\/g, '/');
  return `file:///${normalized}`;
};

const formatDate = (dt) => {
  if (!dt) return '';
  let s = String(dt).replace(' ', 'T');
  if (!/Z|[+-]\d{2}:?\d{2}$/.test(s)) s += 'Z';
  const jst = new Date(new Date(s).getTime() + 9 * 3600 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${jst.getUTCFullYear()}/${pad(jst.getUTCMonth()+1)}/${pad(jst.getUTCDate())} ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
};

/** 進捗／タスク系 API の失敗理由（404 で JSON が無いときは接続・ルーティング・プロキシを示唆） */
const formatProgressApiError = (e) => {
  const d = e.response?.data;
  if (d && typeof d === 'object' && typeof d.error === 'string' && d.error) return d.error;
  if (e.response?.status === 404) {
    return 'APIが見つかりません。APIサーバーを再起動し、npm run dev でプロキシが有効か確認してください。';
  }
  return e.message || '不明なエラー';
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
const weatherByIndex = (v) => {
  if (v === null || v === undefined || !Number.isFinite(v)) {
    return { label: '未評価', icon: CloudQueueIcon, color: 'default' };
  }
  if (v >= 1.0) return { label: '晴れ', icon: WbSunnyIcon, color: 'success' };
  if (v >= 0.9) return { label: 'くもり', icon: CloudQueueIcon, color: 'warning' };
  return { label: '荒天', icon: ThunderstormIcon, color: 'error' };
};

const fmt = (v) => v === null || v === undefined ? '-' : Number(v).toLocaleString();
const fmtIdx = (v) => v === null || v === undefined ? '-' : Number(v).toFixed(2);

/** EVM指標の意味を、計算結果に応じて短文で要約する */
function summarizeEVM(evm) {
  const { sv, cv, spi, cpi, eac, etc, vac } = evm;
  const spiF = spi !== null && Number.isFinite(spi) ? spi : null;
  const cpiF = cpi !== null && Number.isFinite(cpi) ? cpi : null;
  const hasSchedule = spiF !== null && sv !== null;
  const hasCost = cpiF !== null && cv !== null;
  const hasForecast =
    eac !== null && Number.isFinite(eac) &&
    etc !== null && Number.isFinite(etc) &&
    vac !== null && Number.isFinite(vac);

  if (!hasSchedule && !hasCost && !hasForecast) {
    return 'スケジュール指標（SPI 等）には PV・EV、コスト指標（CPI 等）には EV・AC が必要です。AC は月次などで把握できるタイミングでのみ入力すればよく、未入力でも問題ありません。';
  }

  const lines = [];

  if (hasSchedule) {
    if (spiF >= 1) {
      lines.push(`スケジュールは計画より進んでいます（SPI ${spiF.toFixed(2)}）。計画価値に対して出来高が上回っており、SV は ${fmt(sv)} です。`);
    } else if (spiF >= 0.9) {
      lines.push(`スケジュールはやや遅れ気味です（SPI ${spiF.toFixed(2)}）。SV は ${fmt(sv)} で、計画に対して出来高がやや不足しています。`);
    } else {
      lines.push(`スケジュールに遅れがあります（SPI ${spiF.toFixed(2)}）。SV は ${fmt(sv)} で、計画どおりに進めるにはペースの改善が必要です。`);
    }
  } else if (spiF !== null) {
    lines.push(`SPI は ${spiF.toFixed(2)} です（SV は PV・EV 双方が必要なため未表示の場合があります）。`);
  }

  if (hasCost) {
    if (cpiF >= 1) {
      lines.push(`コスト効率は良好です（CPI ${cpiF.toFixed(2)}）。投入したコストに対して出来高が見合っており、CV は ${fmt(cv)} です。`);
    } else if (cpiF >= 0.9) {
      lines.push(`コストはやや超過傾向です（CPI ${cpiF.toFixed(2)}）。CV は ${fmt(cv)} で、予算内収束に注意が必要です。`);
    } else {
      lines.push(`コスト超過が目立ちます（CPI ${cpiF.toFixed(2)}）。CV は ${fmt(cv)} で、原価・スコープ・見積の見直しを検討してください。`);
    }
  } else if (cpiF !== null) {
    lines.push(`CPI は ${cpiF.toFixed(2)} です。`);
  }

  if (hasForecast) {
    lines.push(
      `完成時総コストの見込み（EAC）は ${fmt(eac)}、残作業に必要なコスト見込み（ETC）は ${fmt(etc)} です。完成時予算（BAC）との差（VAC）が ${fmt(vac)} で、${vac >= 0 ? '見込み総コストは BAC を下回る見通しです。' : '見込み総コストが BAC を上回る見通しです。'}`
    );
  }

  return lines.join('\n');
}

/** SPI・CPI を棒グラフで表示（1.0 が計画どおりの基準線） */
function SpiCpiBarChart({ evm }) {
  const theme = useTheme();
  const colorFor = (v) => {
    if (v === null || !Number.isFinite(v)) return theme.palette.grey[400];
    if (v >= 1.0) return theme.palette.success.main;
    if (v >= 0.9) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  const rows = [];
  if (evm.spi !== null && Number.isFinite(evm.spi)) {
    const w = weatherByIndex(evm.spi);
    rows.push({
      name: 'SPI',
      desc: '進捗効率',
      value: evm.spi,
      fill: colorFor(evm.spi),
      weatherEmoji: w.label === '晴れ' ? '☀️' : w.label === 'くもり' ? '☁️' : '⛈️',
    });
  }
  if (evm.cpi !== null && Number.isFinite(evm.cpi)) {
    const w = weatherByIndex(evm.cpi);
    rows.push({
      name: 'CPI',
      desc: 'コスト効率',
      value: evm.cpi,
      fill: colorFor(evm.cpi),
      weatherEmoji: w.label === '晴れ' ? '☀️' : w.label === 'くもり' ? '☁️' : '⛈️',
    });
  }

  if (rows.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, mb: 2 }}>
        SPI は PV・EV、CPI は EV・AC が揃うと表示されます。AC は月に一度などで構いません（未入力の月は CPI 棒は出ません）。
      </Typography>
    );
  }

  const maxVal = Math.max(1, ...rows.map((r) => r.value));
  const yMax = Math.max(1.15, Math.ceil(maxVal * 115) / 100);

  return (
    <Box sx={{ width: '100%', mt: 2.5, mb: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
        SPI・CPI の比較（縦軸 1.0 = 計画どおり、以上は良好傾向）
      </Typography>
      <Box sx={{ width: '100%', height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            margin={{ top: 32, right: 12, left: 4, bottom: 8 }}
            barCategoryGap="28%"
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
              tickLine={false}
              axisLine={{ stroke: theme.palette.divider }}
            />
            <YAxis
              domain={[0, yMax]}
              tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
              tickCount={6}
              width={36}
              axisLine={{ stroke: theme.palette.divider }}
            />
            <ReferenceLine
              y={1}
              stroke={theme.palette.text.disabled}
              strokeDasharray="5 5"
              label={{
                value: '基準 1.0',
                position: 'insideTopRight',
                fill: theme.palette.text.secondary,
                fontSize: 11,
              }}
            />
            <ReTooltip
              formatter={(v) => (typeof v === 'number' ? v.toFixed(3) : v)}
              labelFormatter={(_, p) => {
                const pl = p?.[0]?.payload;
                return pl ? `${pl.name}（${pl.desc}）` : '';
              }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={72}>
              {rows.map((entry, i) => (
                <Cell key={`cell-${i}`} fill={entry.fill} />
              ))}
              <LabelList
                dataKey="value"
                content={(props) => {
                  const { x, y, width, height, value, index } = props;
                  if (typeof value !== 'number') return null;
                  const cx = Number(x) + Number(width) / 2;
                  const emoji = rows?.[Number(index)]?.weatherEmoji || '';
                  const cy = Number(y) + Number(height || 0) / 2 + 4;
                  return (
                    <g>
                      <text x={cx} y={Number(y) - 10} textAnchor="middle" style={{ fontSize: 45 }}>
                        {emoji}
                      </text>
                      <text
                        x={cx}
                        y={cy}
                        textAnchor="middle"
                        style={{ fontSize: 14, fill: '#fff', fontWeight: 700 }}
                      >
                        {value.toFixed(2)}
                      </text>
                    </g>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap', mt: 2 }}>
        {rows.map((r) => (
          <Typography key={r.name} variant="caption" color="text.secondary">
            {r.name}: {r.desc}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}

export default function ProgressTracking() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [project, setProject] = useState(null);
  const [records, setRecords] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  // 新規追加ダイアログ
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    record_date: '', bac: '', pv: '', ev: '', ac: '', evaluation: '', links: [emptyLink()],
  });
  const [addEvalPastedImages, setAddEvalPastedImages] = useState([]);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  // EVM 複製ダイアログ
  const [duplicateSource, setDuplicateSource] = useState(null);
  const [duplicateDate, setDuplicateDate] = useState('');
  const [duplicateSaving, setDuplicateSaving] = useState(false);
  const [duplicateError, setDuplicateError] = useState('');

  // 編集状態
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ bac: '', pv: '', ev: '', ac: '', links: [] });

  // 進捗報告内容の編集
  const [evalEditing, setEvalEditing] = useState({});

  // コメント入力
  const [commentInput, setCommentInput] = useState({});
  /** recordId -> 貼り付け画像 data URL */
  const [commentPastedImages, setCommentPastedImages] = useState({});
  /** 進捗報告内容（EVM）用 貼り付け画像 recordId -> dataUrl[] */
  const [evalPastedImages, setEvalPastedImages] = useState({});

  // タスク追加フィードバック（成功・失敗・警告）
  const [snack, setSnack] = useState({ message: '', severity: 'success', taskLinkId: null, taskStatus: null });
  /** 進行中の「タスクに追加」操作（コメント／進捗報告／下書きごと。全体で1つにしない） */
  const [taskAddInFlight, setTaskAddInFlight] = useState(null);
  /** 下書きから直近作成したタスクID（再追加を阻害しない） */
  const [lastDraftTaskByRecord, setLastDraftTaskByRecord] = useState({});
  /** グラフで選んだ記録を「今回」欄に表示（null なら最新） */
  const [evmKonkaiFocusId, setEvmKonkaiFocusId] = useState(null);

  const taskAddKey = {
    comment: (commentId) => `comment:${commentId}`,
    eval: (recordId) => `eval:${recordId}`,
    draft: (recordId) => `draft:${recordId}`,
  };

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) try { setCurrentUser(JSON.parse(u)); } catch {}
  }, []);

  const loadProject = () =>
    projectsApi.getById(id).then((res) => {
      const { tasks: t = [], ...p } = res.data;
      setProject(p);
      setTasks(t);
      return t;
    });

  const taskStatusMeta = (taskId) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return { label: '—', color: 'default' };
    return {
      label: TASK_STATUS.find((s) => s.value === t.status)?.label || t.status,
      color: TASK_STATUS_COLORS[t.status] || 'default',
    };
  };

  const updateEditLink = (linkId, patch) => {
    setEditForm((prev) => ({
      ...prev,
      links: (prev.links || []).map((l) => (l.id === linkId ? { ...l, ...patch } : l)),
    }));
  };
  const addEditLink = () => setEditForm((prev) => ({ ...prev, links: [...(prev.links || []), emptyLink()] }));
  const removeEditLink = (linkId) =>
    setEditForm((prev) => ({ ...prev, links: (prev.links || []).filter((l) => l.id !== linkId) }));

  const updateAddLink = (linkId, patch) => {
    setAddForm((prev) => ({
      ...prev,
      links: (prev.links || []).map((l) => (l.id === linkId ? { ...l, ...patch } : l)),
    }));
  };
  const addAddLink = () => setAddForm((prev) => ({ ...prev, links: [...(prev.links || []), emptyLink()] }));
  const removeAddLink = (linkId) =>
    setAddForm((prev) => ({ ...prev, links: (prev.links || []).filter((l) => l.id !== linkId) }));

  const loadRecords = () =>
    progressApi
      .getAll(id)
      .then((res) => {
        const data = res.data;
        setRecords(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        setRecords([]);
      });

  useEffect(() => {
    setEvmKonkaiFocusId(null);
    loadProject();
    loadRecords();
  }, [id]);

  useEffect(() => {
    if (evmKonkaiFocusId == null) return;
    if (!records.some((r) => r.id === evmKonkaiFocusId)) {
      setEvmKonkaiFocusId(null);
    }
  }, [records, evmKonkaiFocusId]);

  useEffect(() => {
    const hash = location.hash || '';
    if (!hash.startsWith('#evm-') || records.length === 0) return undefined;
    const anchor = decodeURIComponent(hash.slice(1));
    const raf = requestAnimationFrame(() => {
      const el = document.getElementById(anchor);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => cancelAnimationFrame(raf);
  }, [location.hash, records]);

  // 新規作成
  const handleAdd = async () => {
    if (!addForm.record_date || !id) return;
    setAddError('');
    setAddSaving(true);
    try {
      const evPayload = encodeCommentForStorage(addForm.evaluation, addEvalPastedImages);
      await progressApi.create(id, {
        record_date: addForm.record_date,
        bac: addForm.bac,
        pv: addForm.pv,
        ev: addForm.ev,
        ac: addForm.ac,
        ...(evPayload ? { evaluation: evPayload } : {}),
        links: sanitizeLinksForSave(addForm.links),
      });
      setAddOpen(false);
      setAddForm({ record_date: '', bac: '', pv: '', ev: '', ac: '', evaluation: '', links: [emptyLink()] });
      setAddEvalPastedImages([]);
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

  const openDuplicate = (record) => {
    if (duplicateSaving) return;
    setDuplicateError('');
    setDuplicateSource(record);
    setDuplicateDate(record.record_date || '');
  };

  const closeDuplicate = () => {
    if (duplicateSaving) return;
    setDuplicateSource(null);
    setDuplicateError('');
  };

  const handleDuplicateConfirm = async () => {
    if (!duplicateSource || !duplicateDate.trim()) {
      setDuplicateError('記録日を入力してください');
      return;
    }
    setDuplicateSaving(true);
    setDuplicateError('');
    try {
      await progressApi.duplicate(id, duplicateSource.id, { record_date: duplicateDate.trim() });
      await loadRecords();
      setSnack({ message: 'EVMを複製しました', severity: 'success', taskLinkId: null, taskStatus: null });
      setDuplicateSource(null);
    } catch (e) {
      setDuplicateError(formatProgressApiError(e));
    } finally {
      setDuplicateSaving(false);
    }
  };

  // EVM値編集開始
  const handleEditStart = (record) => {
    setEditingId(record.id);
    setEditForm({
      bac: record.bac ?? '',
      pv: record.pv ?? '',
      ev: record.ev ?? '',
      ac: record.ac ?? '',
      links: normalizeLinks(record.links),
    });
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
      links: sanitizeLinksForSave(editForm.links),
    });
    setEditingId(null);
    loadRecords();
  };

  // 進捗報告内容の保存
  const handleEvalSave = async (record) => {
    const t = getEvalText(record, evalEditing);
    const im = getEvalImages(record, evalPastedImages);
    const payload = encodeCommentForStorage(t, im);
    await progressApi.update(id, record.id, {
      record_date: record.record_date,
      bac: record.bac,
      pv: record.pv,
      ev: record.ev,
      ac: record.ac,
      evaluation: payload || null,
    });
    setEvalEditing((prev) => {
      const n = { ...prev };
      delete n[record.id];
      return n;
    });
    setEvalPastedImages((prev) => {
      const n = { ...prev };
      delete n[record.id];
      return n;
    });
    loadRecords();
  };

  // コメント追加
  const handleAddComment = async (recordId) => {
    const text = commentInput[recordId] || '';
    const imgs = commentPastedImages[recordId] || [];
    const payload = encodeCommentForStorage(text, imgs);
    if (!payload) return;
    await progressApi.addComment(id, recordId, payload);
    setCommentInput((prev) => ({ ...prev, [recordId]: '' }));
    setCommentPastedImages((prev) => ({ ...prev, [recordId]: [] }));
    loadRecords();
  };

  // コメント削除
  const handleDeleteComment = async (recordId, commentId) => {
    await progressApi.deleteComment(id, recordId, commentId);
    loadRecords();
  };

  const taskDeepLink = (taskId) => `/projects/${id}#task-${taskId}`;

  const handleAddCommentAsTask = async (record, comment) => {
    if (comment.linked_task_id) return;
    const k = taskAddKey.comment(comment.id);
    if (taskAddInFlight === k) return;
    setTaskAddInFlight(k);
    try {
      const res = await progressApi.addCommentAsTask(id, record.id, comment.id);
      await Promise.all([loadRecords(), loadProject()]);
      const tid = res.data?.task?.id;
      setSnack({
        message: 'タスクに追加しました',
        severity: 'success',
        taskLinkId: tid || null,
        taskStatus: res.data?.task?.status || null,
      });
    } catch (e) {
      if (e.response?.status === 409) {
        await loadRecords();
        const tList = await loadProject();
        const tid = e.response?.data?.task_id || null;
        const st = tid ? tList?.find((x) => x.id === tid)?.status : null;
        setSnack({
          message: e.response?.data?.error || '既にタスクに追加済みです',
          severity: 'warning',
          taskLinkId: tid,
          taskStatus: st || null,
        });
      } else {
        setSnack({
          message: `タスクの追加に失敗しました: ${formatProgressApiError(e)}`,
          severity: 'error',
          taskLinkId: null,
          taskStatus: null,
        });
      }
    } finally {
      setTaskAddInFlight((cur) => (cur === k ? null : cur));
    }
  };

  const handleAddEvalAsTask = async (record) => {
    if (record.evaluation_linked_task_id) return;
    const k = taskAddKey.eval(record.id);
    if (taskAddInFlight === k) return;
    const t = getEvalText(record, evalEditing);
    const im = getEvalImages(record, evalPastedImages);
    const evaluationPayload = encodeCommentForStorage(t, im);
    if (!evaluationPayload) {
      setSnack({ message: '進捗報告内容を入力してください', severity: 'warning', taskLinkId: null, taskStatus: null });
      return;
    }
    setTaskAddInFlight(k);
    try {
      const res = await progressApi.addEvaluationAsTask(id, record.id, { evaluation: evaluationPayload });
      await Promise.all([loadRecords(), loadProject()]);
      const tid = res.data?.task?.id;
      setSnack({
        message: 'タスクに追加しました',
        severity: 'success',
        taskLinkId: tid || null,
        taskStatus: res.data?.task?.status || null,
      });
    } catch (e) {
      if (e.response?.status === 409) {
        await loadRecords();
        const tList = await loadProject();
        const tid = e.response?.data?.task_id || null;
        const st = tid ? tList?.find((x) => x.id === tid)?.status : null;
        setSnack({
          message: e.response?.data?.error || '既にタスクに追加済みです',
          severity: 'warning',
          taskLinkId: tid,
          taskStatus: st || null,
        });
      } else {
        setSnack({
          message: `タスクの追加に失敗しました: ${formatProgressApiError(e)}`,
          severity: 'error',
          taskLinkId: null,
          taskStatus: null,
        });
      }
    } finally {
      setTaskAddInFlight((cur) => (cur === k ? null : cur));
    }
  };

  const handleAddDraftCommentAsTask = async (recordId) => {
    const k = taskAddKey.draft(recordId);
    if (taskAddInFlight === k) return;
    const text = commentInput[recordId] || '';
    const imgs = commentPastedImages[recordId] || [];
    const title = plainTextForTaskTitleFromDraft(text, imgs);
    if (!title) {
      setSnack({ message: '内容が空のためタスクに追加できません', severity: 'warning', taskLinkId: null, taskStatus: null });
      return;
    }
    const safeTitle = title.length > 500 ? `${title.slice(0, 497)}…` : title;
    setTaskAddInFlight(k);
    try {
      const res = await tasksApi.create({
        project_id: id,
        title: safeTitle,
        description: '進捗確認（EVM）／タイムライン（入力中テキスト）より',
        status: 'todo',
        priority: 'medium',
        progress_record_id: recordId,
      });
      setLastDraftTaskByRecord((prev) => ({ ...prev, [recordId]: res.data.id }));
      await loadProject();
      setSnack({
        message: 'タスクに追加しました（投稿せず）',
        severity: 'success',
        taskLinkId: res.data.id,
        taskStatus: res.data.status || null,
      });
    } catch (e) {
      setSnack({
        message: `タスクの追加に失敗しました: ${formatProgressApiError(e)}`,
        severity: 'error',
        taskLinkId: null,
        taskStatus: null,
      });
    } finally {
      setTaskAddInFlight((cur) => (cur === k ? null : cur));
    }
  };

  const progressCommentHash = (commentId) => `evm-comment-${commentId}`;
  const progressEvalHash = (recordId) => `evm-eval-${recordId}`;

  // グラフ用データ（record_date ASC）
  const chartData = records.map((r) => ({
    date: r.record_date,
    recordId: r.id,
    PV: r.pv !== null && r.pv !== undefined ? Number(r.pv) : null,
    EV: r.ev !== null && r.ev !== undefined ? Number(r.ev) : null,
    AC: r.ac !== null && r.ac !== undefined ? Number(r.ac) : null,
  }));
  const maxBac = records.reduce((m, r) => r.bac !== null && r.bac !== undefined ? Math.max(m, Number(r.bac)) : m, 0);

  // 表示は record_date DESC
  const sortedRecords = [...records].sort((a, b) => b.record_date.localeCompare(a.record_date));

  const setKonkaiFromChart = (recordId) => {
    if (recordId == null) return;
    setEvmKonkaiFocusId(recordId);
  };

  const pickRecordIdFromChartClickState = (state) => {
    if (!state || typeof state !== 'object') return null;
    const idx = state.activeTooltipIndex;
    if (typeof idx === 'number' && chartData[idx]?.recordId != null) {
      return chartData[idx].recordId;
    }
    const label = state.activeLabel;
    if (label != null) {
      const row = chartData.find((d) => d.date === label);
      if (row?.recordId != null) return row.recordId;
    }
    return null;
  };

  const evmChartDot = (strokeColor) => (dotProps) => {
    const { cx, cy, payload } = dotProps;
    if (cx == null || cy == null || payload?.recordId == null) return null;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={strokeColor}
        stroke="#fff"
        strokeWidth={1}
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          setKonkaiFromChart(payload.recordId);
        }}
      />
    );
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
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                onClick={(state) => {
                  const rid = pickRecordIdFromChartClickState(state);
                  if (rid != null) setKonkaiFromChart(rid);
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={(tickProps) => {
                    const { x, y, payload, fill } = tickProps;
                    const dateVal = payload?.value;
                    return (
                      <text
                        x={x}
                        y={y}
                        dy={16}
                        textAnchor="middle"
                        fill={fill ?? '#666'}
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const rec = records.find((r) => r.record_date === dateVal);
                          if (rec) setKonkaiFromChart(rec.id);
                        }}
                      >
                        {dateVal}
                      </text>
                    );
                  }}
                />
                <YAxis />
                <ReTooltip />
                <Legend />
                {maxBac > 0 && (
                  <ReferenceLine y={maxBac} stroke="#9e9e9e" strokeDasharray="6 3" label={{ value: 'BAC', position: 'right', fill: '#9e9e9e' }} />
                )}
                <Line type="monotone" dataKey="PV" stroke="#1976d2" strokeWidth={2} dot={evmChartDot('#1976d2')} connectNulls />
                <Line type="monotone" dataKey="EV" stroke="#388e3c" strokeWidth={2} dot={evmChartDot('#388e3c')} connectNulls />
                <Line type="monotone" dataKey="AC" stroke="#d32f2f" strokeWidth={2} dot={evmChartDot('#d32f2f')} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* 進捗記録リスト */}
      {sortedRecords.length === 0 ? (
        <Typography color="text.secondary">進捗記録がありません。「+ 新規進捗記録」から追加してください。</Typography>
      ) : (
        (() => {
          const latest = sortedRecords[0] || null;
          const focusRecord =
            evmKonkaiFocusId != null
              ? records.find((r) => r.id === evmKonkaiFocusId) ?? latest
              : latest;
          const recordsAsc = [...records].sort((a, b) => a.record_date.localeCompare(b.record_date));
          const focusIdx = focusRecord ? recordsAsc.findIndex((r) => r.id === focusRecord.id) : -1;
          const previousFromFocus = focusIdx > 0 ? recordsAsc[focusIdx - 1] : null;

          const current = focusRecord;
          const previous = previousFromFocus;

          const shownTopIds = new Set([current?.id, previous?.id].filter(Boolean));
          const restRecords = sortedRecords.filter((r) => !shownTopIds.has(r.id));

          const renderRecordCard = (record, headerLabel) => {
            if (!record) return null;
            const comments = Array.isArray(record.comments) ? record.comments : [];
            const evm = calcEVM(record.bac, record.pv, record.ev, record.ac);
            const isEditing = editingId === record.id;
            const evalText = getEvalText(record, evalEditing);
            const evalImgs = getEvalImages(record, evalPastedImages);
            const isEvalDirty = !evaluationsEquivalent(
              record.evaluation,
              evalEditing[record.id],
              evalPastedImages[record.id]
            );
            const evalHasContent = Boolean(encodeCommentForStorage(evalText, evalImgs));
            const evalTaskMeta = record.evaluation_linked_task_id
              ? taskStatusMeta(record.evaluation_linked_task_id)
              : null;

            return (
              <Card key={record.id} id={`evm-record-${record.id}`} sx={{ mb: 3, scrollMarginTop: 88 }}>
                <CardContent>
                  {/* ヘッダー */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                      {headerLabel ? (
                        <Chip
                          size="small"
                          color={headerLabel === '今回' ? 'primary' : 'default'}
                          label={headerLabel}
                          variant={headerLabel === '今回' ? 'filled' : 'outlined'}
                        />
                      ) : null}
                      <Typography variant="h6">{record.record_date}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Tooltip title="EVMを複製（BAC/PV/EV/AC・進捗報告内容のみ。タイムラインのコメントは含みません）">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => openDuplicate(record)}
                            disabled={duplicateSaving}
                            aria-label="EVMを複製"
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <IconButton color="error" size="small" onClick={() => handleDelete(record.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </Box>
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
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <TextField
                          label="BAC（完成時予算／Budget at Completion）"
                          type="number"
                          size="small"
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                          value={isEditing ? editForm.bac : (record.bac ?? '')}
                          onChange={e => setEditForm(prev => ({ ...prev, bac: e.target.value }))}
                          InputProps={{ readOnly: !isEditing }}
                        />
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <TextField
                          label="PV（計画価値／Planned Value）"
                          type="number"
                          size="small"
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                          value={isEditing ? editForm.pv : (record.pv ?? '')}
                          onChange={e => setEditForm(prev => ({ ...prev, pv: e.target.value }))}
                          InputProps={{ readOnly: !isEditing }}
                        />
                      </Grid>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <TextField
                          label="EV（出来高の価値／Earned Value）"
                          type="number"
                          size="small"
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                          value={isEditing ? editForm.ev : (record.ev ?? '')}
                          onChange={e => setEditForm(prev => ({ ...prev, ev: e.target.value }))}
                          InputProps={{ readOnly: !isEditing }}
                        />
                      </Grid>
                      <Grid size={{ xs: 6, sm: 3 }}>
                        <TextField
                          label="AC（実績コスト／Actual Cost）"
                          type="number"
                          size="small"
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                          helperText="任意（月次などで未入力可）"
                          FormHelperTextProps={{ sx: { mt: 0.25 } }}
                          value={isEditing ? editForm.ac : (record.ac ?? '')}
                          onChange={e => setEditForm(prev => ({ ...prev, ac: e.target.value }))}
                          InputProps={{ readOnly: !isEditing }}
                        />
                      </Grid>
                    </Grid>
                  </Box>

                  {/* 参照リンク（URL / ファイルパス） */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                      参照リンク（複数可）
                    </Typography>
                    {isEditing ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {(editForm.links || []).map((l) => (
                          <Box key={l.id} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                            <TextField
                              select
                              size="small"
                              label="種類"
                              value={l.type}
                              onChange={(e) => updateEditLink(l.id, { type: e.target.value })}
                              sx={{ width: 130 }}
                            >
                              {LINK_TYPE_OPTIONS.map((o) => (
                                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                              ))}
                            </TextField>
                            <TextField
                              size="small"
                              label={l.type === 'url' ? 'URL' : 'ファイルパス'}
                              value={l.value}
                              onChange={(e) => updateEditLink(l.id, { value: e.target.value })}
                              sx={{ minWidth: 280, flex: '1 1 280px' }}
                            />
                            <TextField
                              size="small"
                              label="表示名（任意）"
                              value={l.label}
                              onChange={(e) => updateEditLink(l.id, { label: e.target.value })}
                              sx={{ minWidth: 180, flex: '1 1 180px' }}
                            />
                            <IconButton size="small" color="error" onClick={() => removeEditLink(l.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        ))}
                        <Button size="small" variant="outlined" onClick={addEditLink} sx={{ alignSelf: 'flex-start' }}>
                          + リンク追加
                        </Button>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {normalizeLinks(record.links).length === 0 ? (
                          <Typography variant="body2" color="text.secondary">リンクはありません</Typography>
                        ) : (
                          normalizeLinks(record.links).map((l) => (
                            <Link
                              key={l.id}
                              href={toLinkHref(l)}
                              target="_blank"
                              rel="noreferrer"
                              sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, width: 'fit-content' }}
                            >
                              <Chip size="small" variant="outlined" label={l.type === 'url' ? 'URL' : 'FILE'} />
                              <Typography variant="body2">{l.label || l.value}</Typography>
                            </Link>
                          ))
                        )}
                      </Box>
                    )}
                  </Box>

                  {/* EVM指標（計算値） */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>EVM指標</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {(() => {
                        const w = weatherByIndex(evm.spi);
                        const Icon = w.icon;
                        return (
                          <Chip
                            icon={<Icon fontSize="small" />}
                            label={`SPI: ${fmtIdx(evm.spi)}（${w.label}）`}
                            color={indexColor(evm.spi)}
                            size="small"
                          />
                        );
                      })()}
                      {(() => {
                        const w = weatherByIndex(evm.cpi);
                        const Icon = w.icon;
                        return (
                          <Chip
                            icon={<Icon fontSize="small" />}
                            label={`CPI: ${fmtIdx(evm.cpi)}（${w.label}）`}
                            color={indexColor(evm.cpi)}
                            size="small"
                          />
                        );
                      })()}
                      <Chip label={`SV: ${fmt(evm.sv)}`} color={varColor(evm.sv)} size="small" variant="outlined" />
                      <Chip label={`CV: ${fmt(evm.cv)}`} color={varColor(evm.cv)} size="small" variant="outlined" />
                      <Chip label={`EAC: ${fmt(evm.eac)}`} color="default" size="small" variant="outlined" />
                      <Chip label={`ETC: ${fmt(evm.etc)}`} color="default" size="small" variant="outlined" />
                      <Chip label={`VAC: ${fmt(evm.vac)}`} color={varColor(evm.vac)} size="small" variant="outlined" />
                    </Box>
                    <SpiCpiBarChart evm={evm} />
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mt: 3,
                        p: 1.5,
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                        whiteSpace: 'pre-line',
                        lineHeight: 1.65,
                      }}
                    >
                      {summarizeEVM(evm)}
                    </Typography>
                  </Box>

                  {/* 進捗報告内容 */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                      進捗報告内容
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                      画面キャプチャはこの欄に貼り付け（Ctrl+V）できます（最大 {MAX_PASTED_IMAGES_PER_COMMENT} 枚）。
                    </Typography>
                    <PastedImagesPreview
                      images={evalImgs}
                      max={MAX_PASTED_IMAGES_PER_COMMENT}
                      onRemove={(index) =>
                        setEvalPastedImages((prev) => {
                          const rid = record.id;
                          const base =
                            prev[rid] !== undefined
                              ? [...prev[rid]]
                              : [...decodeCommentStored(record.evaluation || '').images];
                          base.splice(index, 1);
                          return { ...prev, [rid]: base };
                        })
                      }
                    />
                    <Box id={`evm-eval-${record.id}`} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap', scrollMarginTop: 88 }}>
                      <TextField
                        multiline
                        minRows={2}
                        fullWidth
                        size="small"
                        placeholder="進捗報告の内容を入力...（画像は貼り付け）"
                        value={evalText}
                        onChange={(e) => setEvalEditing((prev) => ({ ...prev, [record.id]: e.target.value }))}
                        onPaste={async (e) => {
                          const url = await tryConsumeClipboardImageAsDataUrl(e.clipboardData);
                          if (url) {
                            e.preventDefault();
                            setEvalPastedImages((prev) => {
                              const rid = record.id;
                              const base =
                                prev[rid] !== undefined
                                  ? [...prev[rid]]
                                  : [...decodeCommentStored(record.evaluation || '').images];
                              if (base.length >= MAX_PASTED_IMAGES_PER_COMMENT) return prev;
                              return { ...prev, [rid]: [...base, url] };
                            });
                          }
                        }}
                        sx={{ flex: '1 1 240px', minWidth: 0 }}
                      />
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, alignItems: 'stretch' }}>
                        {isEvalDirty && (
                          <Button variant="contained" size="small" onClick={() => handleEvalSave(record)} sx={{ whiteSpace: 'nowrap' }}>
                            保存
                          </Button>
                        )}
                        {record.evaluation_linked_task_id ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                              <Chip
                                size="small"
                                label={evalTaskMeta?.label ?? '—'}
                                color={evalTaskMeta?.color ?? 'default'}
                                variant="outlined"
                              />
                              <Link
                                component={RouterLink}
                                to={taskDeepLink(record.evaluation_linked_task_id)}
                                variant="body2"
                                sx={{ whiteSpace: 'nowrap' }}
                              >
                                作成したタスクを開く
                              </Link>
                            </Box>
                            <Link
                              component={RouterLink}
                              to={`/projects/${id}/progress#${progressEvalHash(record.id)}`}
                              variant="caption"
                              color="text.secondary"
                              sx={{ whiteSpace: 'nowrap' }}
                            >
                              この進捗報告位置へ
                            </Link>
                          </Box>
                        ) : (
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<PlaylistAddIcon />}
                            disabled={taskAddInFlight === taskAddKey.eval(record.id) || !evalHasContent}
                            onClick={() => handleAddEvalAsTask(record)}
                            sx={{ whiteSpace: 'nowrap' }}
                          >
                            進捗報告をタスクに追加
                          </Button>
                        )}
                      </Box>
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
                            id={progressCommentHash(c.id)}
                            alignItems="flex-start"
                            disableGutters
                            sx={{ pr: 0, scrollMarginTop: 88 }}
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
                              secondary={
                                <Box>
                                  <CommentRichContent value={c.comment} />
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mt: 0.75 }}>
                                    {c.linked_task_id ? (
                                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, alignItems: 'flex-start' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                          <Chip
                                            size="small"
                                            label={taskStatusMeta(c.linked_task_id).label}
                                            color={taskStatusMeta(c.linked_task_id).color}
                                            variant="outlined"
                                          />
                                          <Link
                                            component={RouterLink}
                                            to={taskDeepLink(c.linked_task_id)}
                                            variant="body2"
                                            sx={{ textTransform: 'none' }}
                                          >
                                            作成したタスクを開く
                                          </Link>
                                        </Box>
                                        <Link
                                          component={RouterLink}
                                          to={`/projects/${id}/progress#${progressCommentHash(c.id)}`}
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          このコメント位置へ
                                        </Link>
                                      </Box>
                                    ) : (
                                      <Button
                                        variant="text"
                                        size="small"
                                        startIcon={<PlaylistAddIcon fontSize="small" />}
                                        disabled={taskAddInFlight === taskAddKey.comment(c.id)}
                                        onClick={() => handleAddCommentAsTask(record, c)}
                                        sx={{ textTransform: 'none', minHeight: 32 }}
                                      >
                                        タスクに追加
                                      </Button>
                                    )}
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
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        画面キャプチャはこの欄に貼り付け（Ctrl+V）できます（最大 {MAX_PASTED_IMAGES_PER_COMMENT} 枚）。
                      </Typography>
                      <PastedImagesPreview
                        images={commentPastedImages[record.id] || []}
                        max={MAX_PASTED_IMAGES_PER_COMMENT}
                        onRemove={(index) =>
                          setCommentPastedImages((prev) => {
                            const cur = [...(prev[record.id] || [])];
                            cur.splice(index, 1);
                            return { ...prev, [record.id]: cur };
                          })
                        }
                      />
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                        <TextField
                          size="small"
                          fullWidth
                          placeholder="コメントを入力...（画像は貼り付け）"
                          multiline
                          maxRows={4}
                          value={commentInput[record.id] || ''}
                          onChange={e => setCommentInput(prev => ({ ...prev, [record.id]: e.target.value }))}
                          onPaste={async (e) => {
                            const url = await tryConsumeClipboardImageAsDataUrl(e.clipboardData);
                            if (url) {
                              e.preventDefault();
                              setCommentPastedImages((prev) => {
                                const cur = prev[record.id] || [];
                                if (cur.length >= MAX_PASTED_IMAGES_PER_COMMENT) return prev;
                                return { ...prev, [record.id]: [...cur, url] };
                              });
                            }
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAddComment(record.id);
                            }
                          }}
                        />
                        <Tooltip title="コメントを投稿">
                          <span>
                            <IconButton
                              color="primary"
                              onClick={() => handleAddComment(record.id)}
                              disabled={
                                !encodeCommentForStorage(
                                  commentInput[record.id] || '',
                                  commentPastedImages[record.id] || []
                                )
                              }
                            >
                              <SendIcon />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<PlaylistAddIcon />}
                        disabled={
                          taskAddInFlight === taskAddKey.draft(record.id) ||
                          !plainTextForTaskTitleFromDraft(
                            commentInput[record.id] || '',
                            commentPastedImages[record.id] || []
                          )
                        }
                        onClick={() => handleAddDraftCommentAsTask(record.id)}
                        sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
                      >
                        入力中の内容をタスクに追加（投稿せず）
                      </Button>
                      {lastDraftTaskByRecord[record.id] ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, alignItems: 'flex-start' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Chip
                              size="small"
                              label={taskStatusMeta(lastDraftTaskByRecord[record.id]).label}
                              color={taskStatusMeta(lastDraftTaskByRecord[record.id]).color}
                              variant="outlined"
                            />
                            <Link
                              component={RouterLink}
                              to={taskDeepLink(lastDraftTaskByRecord[record.id])}
                              variant="caption"
                              sx={{ alignSelf: 'flex-start' }}
                            >
                              直近に作成したタスクを開く
                            </Link>
                          </Box>
                          <Link
                            component={RouterLink}
                            to={`/projects/${id}/progress#${progressEvalHash(record.id)}`}
                            variant="caption"
                            color="text.secondary"
                          >
                            この進捗記録へ
                          </Link>
                        </Box>
                      ) : null}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            );
          };

          return (
            <Box>
              {previous && current ? (
                <Grid container spacing={2} alignItems="flex-start">
                  <Grid size={{ xs: 12, sm: 6 }}>
                    {renderRecordCard(previous, '前回')}
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    {renderRecordCard(current, '今回')}
                  </Grid>
                </Grid>
              ) : (
                renderRecordCard(current || previous, sortedRecords.length === 1 ? '' : '今回')
              )}

              {restRecords.length > 0 ? (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    過去の記録
                  </Typography>
                  {restRecords.map((r) => renderRecordCard(r, ''))}
                </Box>
              ) : null}
            </Box>
          );
        })()
      )}

      <Dialog open={Boolean(duplicateSource)} onClose={closeDuplicate} maxWidth="xs" fullWidth>
        <DialogTitle>EVMの複製</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {duplicateError ? (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDuplicateError('')}>
              {duplicateError}
            </Alert>
          ) : null}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            BAC・PV・EV・AC・進捗報告内容をコピーして新しい進捗記録を追加します。タイムラインのコメントとタスクへの紐付けは含みません。
          </Typography>
          <TextField
            label="新しい記録日 *"
            type="date"
            value={duplicateDate}
            onChange={(e) => setDuplicateDate(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDuplicate} disabled={duplicateSaving}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={handleDuplicateConfirm}
            disabled={!duplicateDate.trim() || duplicateSaving}
          >
            {duplicateSaving ? '複製中…' : '複製'}
          </Button>
        </DialogActions>
      </Dialog>

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
            <Grid size={{ xs: 6 }}>
              <TextField
                label="BAC（完成時予算／Budget at Completion）"
                type="number"
                value={addForm.bac}
                onChange={e => setAddForm(prev => ({ ...prev, bac: e.target.value }))}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="PV（計画価値／Planned Value）"
                type="number"
                value={addForm.pv}
                onChange={e => setAddForm(prev => ({ ...prev, pv: e.target.value }))}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="EV（出来高の価値／Earned Value）"
                type="number"
                value={addForm.ev}
                onChange={e => setAddForm(prev => ({ ...prev, ev: e.target.value }))}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="AC（実績コスト／Actual Cost）"
                type="number"
                value={addForm.ac}
                onChange={e => setAddForm(prev => ({ ...prev, ac: e.target.value }))}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                helperText="任意（月次把握のため未入力可）"
                FormHelperTextProps={{ sx: { mt: 0.25 } }}
              />
            </Grid>
          </Grid>
          <Typography variant="caption" color="text.secondary" display="block">
            進捗報告内容（画像は Ctrl+V で貼り付け、最大 {MAX_PASTED_IMAGES_PER_COMMENT} 枚）
          </Typography>
          <PastedImagesPreview
            images={addEvalPastedImages}
            max={MAX_PASTED_IMAGES_PER_COMMENT}
            onRemove={(index) =>
              setAddEvalPastedImages((cur) => {
                const next = [...cur];
                next.splice(index, 1);
                return next;
              })
            }
          />
          <TextField
            label="進捗報告内容"
            multiline
            rows={3}
            value={addForm.evaluation}
            onChange={(e) => setAddForm((prev) => ({ ...prev, evaluation: e.target.value }))}
            onPaste={async (e) => {
              const url = await tryConsumeClipboardImageAsDataUrl(e.clipboardData);
              if (url) {
                e.preventDefault();
                setAddEvalPastedImages((cur) => {
                  if (cur.length >= MAX_PASTED_IMAGES_PER_COMMENT) return cur;
                  return [...cur, url];
                });
              }
            }}
            fullWidth
            placeholder="この時点の進捗・状況を入力...（画像は貼り付け）"
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">参照リンク（URL / ファイルパス、複数可）</Typography>
            {(addForm.links || []).map((l) => (
              <Box key={l.id} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <TextField
                  select
                  size="small"
                  label="種類"
                  value={l.type}
                  onChange={(e) => updateAddLink(l.id, { type: e.target.value })}
                  sx={{ width: 130 }}
                >
                  {LINK_TYPE_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  label={l.type === 'url' ? 'URL' : 'ファイルパス'}
                  value={l.value}
                  onChange={(e) => updateAddLink(l.id, { value: e.target.value })}
                  sx={{ minWidth: 280, flex: '1 1 280px' }}
                />
                <TextField
                  size="small"
                  label="表示名（任意）"
                  value={l.label}
                  onChange={(e) => updateAddLink(l.id, { label: e.target.value })}
                  sx={{ minWidth: 180, flex: '1 1 180px' }}
                />
                <IconButton size="small" color="error" onClick={() => removeAddLink(l.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Button size="small" variant="outlined" onClick={addAddLink} sx={{ alignSelf: 'flex-start' }}>
              + リンク追加
            </Button>
          </Box>
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

      <Snackbar
        open={Boolean(snack.message)}
        autoHideDuration={snack.severity === 'error' ? 5000 : 2800}
        onClose={() => setSnack({ message: '', severity: 'success', taskLinkId: null, taskStatus: null })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnack({ message: '', severity: 'success', taskLinkId: null, taskStatus: null })}
          severity={snack.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
            <span>{snack.message}</span>
            {snack.taskLinkId ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                {snack.taskStatus ? (
                  <Chip
                    size="small"
                    label={TASK_STATUS.find((s) => s.value === snack.taskStatus)?.label || snack.taskStatus}
                    sx={{
                      height: 22,
                      fontSize: '0.75rem',
                      bgcolor: 'rgba(255,255,255,0.22)',
                      color: 'inherit',
                      border: '1px solid rgba(255,255,255,0.45)',
                    }}
                  />
                ) : null}
                <Link
                  component={RouterLink}
                  to={`/projects/${id}#task-${snack.taskLinkId}`}
                  color="inherit"
                  sx={{ fontWeight: 600, textDecoration: 'underline' }}
                >
                  作成したタスクを開く
                </Link>
              </Box>
            ) : null}
          </Box>
        </Alert>
      </Snackbar>
    </Box>
  );
}
