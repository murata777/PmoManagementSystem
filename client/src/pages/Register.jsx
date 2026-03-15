import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, CircularProgress
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { authApi } from '../auth';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState(''); // 開発用

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await authApi.register(form);
      setSuccess(res.data.message);
      if (res.data.tempPassword) {
        setTempPassword(res.data.tempPassword);
      }
      setForm({ name: '', email: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'アカウント作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}>
      <Card sx={{ width: '100%', maxWidth: 420, p: 2 }}>
        <CardContent>
          <Typography variant="h5" align="center" gutterBottom fontWeight="bold">
            PMO Management System
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
            新規アカウント登録
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {success ? (
            <Box sx={{ textAlign: 'center' }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 48, mb: 1 }} />
              <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>
              {tempPassword && (
                <Alert severity="warning" sx={{ mb: 2, textAlign: 'left' }}>
                  <strong>開発環境用 - 初期パスワード:</strong><br />
                  <code style={{ fontSize: '1.1em' }}>{tempPassword}</code><br />
                  <small>（本番環境ではこの表示は行われません）</small>
                </Alert>
              )}
              <Typography variant="body2" sx={{ mb: 2 }}>
                メールに記載された初期パスワードでログインしてください。
              </Typography>
              <Button variant="contained" component={Link} to="/login" fullWidth>
                ログイン画面へ
              </Button>
            </Box>
          ) : (
            <>
              <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="お名前"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  fullWidth
                  autoFocus
                />
                <TextField
                  label="メールアドレス"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  fullWidth
                  helperText="初期パスワードをこのアドレスに送信します"
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={loading}
                >
                  {loading ? <CircularProgress size={24} /> : 'アカウント作成'}
                </Button>
              </Box>

              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Typography variant="body2">
                  既にアカウントをお持ちの方は{' '}
                  <Link to="/login" style={{ color: '#1976d2' }}>ログイン</Link>
                </Typography>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
