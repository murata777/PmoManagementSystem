import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import { featureRequestsApi } from '../api';
import { getStoredUser } from '../auth';

function formatWhen(iso) {
  if (!iso) return '—';
  const s = String(iso).replace(' ', 'T');
  const d = new Date(/Z|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}Z`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FeatureRequests() {
  const user = getStoredUser();
  const isAdmin = Boolean(user?.is_admin);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitOk, setSubmitOk] = useState(false);

  const [list, setList] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');

  const loadList = useCallback(async () => {
    if (!isAdmin) return;
    setListLoading(true);
    setListError('');
    try {
      const { data } = await featureRequestsApi.listAll();
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setListError(e.response?.data?.error || e.message || '一覧の取得に失敗しました');
      setList([]);
    } finally {
      setListLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setSubmitting(true);
    setSubmitError('');
    setSubmitOk(false);
    try {
      await featureRequestsApi.create({
        title: t,
        body: body.trim() || undefined,
      });
      setTitle('');
      setBody('');
      setSubmitOk(true);
      if (isAdmin) await loadList();
    } catch (err) {
      setSubmitError(err.response?.data?.error || err.message || '送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FeedbackOutlinedIcon color="primary" />
        要望の入力
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        機能追加や改善のご希望を送信できます。内容は管理者が一覧で確認します（他の利用者からは見えません）。
      </Typography>

      <Card sx={{ mb: 4, maxWidth: 640 }}>
        <CardContent component="form" onSubmit={handleSubmit}>
          {submitError ? (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError('')}>
              {submitError}
            </Alert>
          ) : null}
          {submitOk ? (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSubmitOk(false)}>
              要望を送信しました。ありがとうございます。
            </Alert>
          ) : null}
          <TextField
            label="タイトル"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            placeholder="例：タスク一覧にエクスポート機能が欲しい"
          />
          <TextField
            label="詳細（任意）"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            fullWidth
            multiline
            minRows={5}
            placeholder="背景・使いたい場面・期待する動作などを具体的に書いてください。"
          />
          <Box sx={{ mt: 2 }}>
            <Button type="submit" variant="contained" disabled={submitting || !title.trim()}>
              {submitting ? '送信中…' : '送信する'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {isAdmin ? (
        <>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
            要望一覧（管理者のみ）
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            全利用者から送信された要望が新しい順に表示されます。
          </Typography>
          {listError ? (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setListError('')}>
              {listError}
            </Alert>
          ) : null}
          {listLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : list.length === 0 ? (
            <Typography color="text.secondary">まだ要望はありません。</Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width="160">受付日時</TableCell>
                    <TableCell width="140">提出者</TableCell>
                    <TableCell width="200">メール</TableCell>
                    <TableCell>タイトル</TableCell>
                    <TableCell>詳細</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {list.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell sx={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                        {formatWhen(row.created_at)}
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'top' }}>{row.user_name || '—'}</TableCell>
                      <TableCell sx={{ verticalAlign: 'top', wordBreak: 'break-all', fontSize: '0.8125rem' }}>
                        {row.user_email || '—'}
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'top', fontWeight: 600 }}>{row.title}</TableCell>
                      <TableCell sx={{ verticalAlign: 'top', whiteSpace: 'pre-wrap', maxWidth: 360 }}>
                        {row.body || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      ) : null}
    </Box>
  );
}
