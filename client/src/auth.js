import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// リクエストにJWTトークンを自動付与
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  changePassword: (data) => api.post('/auth/change-password', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  me: () => api.get('/auth/me'),
};

export function saveAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function getStoredUser() {
  const u = localStorage.getItem('user');
  return u ? JSON.parse(u) : null;
}

export function getToken() {
  return localStorage.getItem('token');
}
