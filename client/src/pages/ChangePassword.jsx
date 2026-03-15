import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, InputAdornment, IconButton, CircularProgress
} from '@mui/material';
import LockResetIcon from '@mui/icons-material/LockReset';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { authApi } from '../auth';

export default function ChangePassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const forced = location.state?.forced;

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirmPassword) {
      setError('新しいパスワードが一致しません');
      return;
    }
    if (form.newPassword.length < 8) {
      setError('パスワードは8文字以上で入力してください');
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'パスワード変更に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (field) => setShow((prev) => ({ ...prev, [field]: !prev[field] }));

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5' }}>
      <Card sx={{ width: '100%', maxWidth: 420, p: 2 }}>
        <CardContent>
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <LockResetIcon color="primary" sx={{ fontSize: 48 }} />
            <Typography variant="h6" fontWeight="bold">パスワード変更</Typography>
            {forced && (
              <Alert severity="warning" sx={{ mt: 1, textAlign: 'left' }}>
                初期パスワードでログインしました。セキュリティのため新しいパスワードを設定してください。
              </Alert>
            )}
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[
              { key: 'current', label: '現在のパスワード', field: 'currentPassword' },
              { key: 'new', label: '新しいパスワード（8文字以上）', field: 'newPassword' },
              { key: 'confirm', label: '新しいパスワード（確認）', field: 'confirmPassword' },
            ].map(({ key, label, field }) => (
              <TextField
                key={key}
                label={label}
                type={show[key] ? 'text' : 'password'}
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                required
                fullWidth
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => toggle(key)} edge="end">
                        {show[key] ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            ))}
            <Button type="submit" variant="contained" size="large" fullWidth disabled={loading}>
              {loading ? <CircularProgress size={24} /> : 'パスワードを変更する'}
            </Button>
            {!forced && (
              <Button variant="text" fullWidth onClick={() => navigate(-1)}>キャンセル</Button>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
