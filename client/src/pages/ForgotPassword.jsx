import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, CircularProgress
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { authApi } from '../auth';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.forgotPassword({ email });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || '処理に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}>
      <Card sx={{ width: '100%', maxWidth: 420, p: 2 }}>
        <CardContent>
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <EmailIcon color="primary" sx={{ fontSize: 48 }} />
            <Typography variant="h6" fontWeight="bold">パスワードをお忘れの方</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              登録済みのメールアドレスに新しい初期パスワードを送信します
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {result ? (
            <Box sx={{ textAlign: 'center' }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 48, mb: 1 }} />
              <Alert severity="success" sx={{ mb: 2 }}>{result.message}</Alert>
              {result.tempPassword && (
                <Alert severity="warning" sx={{ mb: 2, textAlign: 'left' }}>
                  <strong>開発環境用 - 初期パスワード:</strong><br />
                  <code style={{ fontSize: '1.1em' }}>{result.tempPassword}</code><br />
                  <small>（本番環境ではこの表示は行われません）</small>
                </Alert>
              )}
              <Typography variant="body2" sx={{ mb: 2 }}>
                メールに記載された初期パスワードでログインし、パスワードを変更してください。
              </Typography>
              <Button variant="contained" component={Link} to="/login" fullWidth>
                ログイン画面へ
              </Button>
            </Box>
          ) : (
            <>
              <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="メールアドレス"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  fullWidth
                  autoFocus
                />
                <Button type="submit" variant="contained" size="large" fullWidth disabled={loading}>
                  {loading ? <CircularProgress size={24} /> : '初期パスワードを送信する'}
                </Button>
              </Box>
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Link to="/login" style={{ color: '#1976d2', fontSize: '0.9em' }}>
                  ログイン画面に戻る
                </Link>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
