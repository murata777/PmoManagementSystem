import axios from 'axios';
import { getToken, clearAuth } from './auth';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      clearAuth();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const projectsApi = {
  getAll: () => api.get('/projects'),
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  /** タスクは複製しない。カスタム項目は複製。body.name で新プロジェクト名を指定可 */
  duplicate: (id, body) => api.post(`/projects/${id}/duplicate`, body || {}),
};

export const tasksApi = {
  /** @param {string} [projectId] 省略時は全プロジェクトのタスク */
  getAll: (projectId) =>
    api.get('/tasks', projectId ? { params: { project_id: projectId } } : {}),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  delete: (id) => api.delete(`/tasks/${id}`),
};

export const membersApi = {
  getAll: () => api.get('/members'),
  create: (data) => api.post('/members', data),
  update: (id, data) => api.put(`/members/${id}`, data),
  delete: (id) => api.delete(`/members/${id}`),
};

export const dashboardApi = {
  getStats: () => api.get('/dashboard'),
};

export const activityLogsApi = {
  getAll: (params) => api.get('/activity-logs', { params }),
};

export const customFieldsApi = {
  getAll: (projectId) => api.get(`/projects/${projectId}/fields`),
  create: (projectId, data) => api.post(`/projects/${projectId}/fields`, data),
  update: (projectId, fieldId, data) => api.put(`/projects/${projectId}/fields/${fieldId}`, data),
  delete: (projectId, fieldId) => api.delete(`/projects/${projectId}/fields/${fieldId}`),
};

export const taskCommentsApi = {
  getAll: (taskId) => api.get(`/tasks/${taskId}/comments`),
  create: (taskId, data) => api.post(`/tasks/${taskId}/comments`, data),
  delete: (taskId, commentId) => api.delete(`/tasks/${taskId}/comments/${commentId}`),
};

export const phaseGatesApi = {
  getAll: (projectId) => api.get(`/projects/${projectId}/phase-gates`),
  updateStatus: (projectId, phaseKey, status) => api.put(`/projects/${projectId}/phase-gates/${phaseKey}`, { status }),
  updateMetrics: (projectId, phaseKey, metrics) => api.put(`/projects/${projectId}/phase-gates/${phaseKey}/metrics`, { metrics }),
  addComment: (projectId, phaseKey, comment) => api.post(`/projects/${projectId}/phase-gates/${phaseKey}/comments`, { comment }),
  deleteComment: (projectId, phaseKey, commentId) => api.delete(`/projects/${projectId}/phase-gates/${phaseKey}/comments/${commentId}`),
};

export const progressApi = {
  getAll: (projectId) => api.get(`/projects/${projectId}/progress`),
  create: (projectId, data) => api.post(`/projects/${projectId}/progress`, data),
  update: (projectId, recordId, data) => api.put(`/projects/${projectId}/progress/${recordId}`, data),
  delete: (projectId, recordId) => api.delete(`/projects/${projectId}/progress/${recordId}`),
  duplicate: (projectId, recordId, body) =>
    api.post(`/projects/${projectId}/progress/${recordId}/duplicate`, body || {}),
  addComment: (projectId, recordId, comment) => api.post(`/projects/${projectId}/progress/${recordId}/comments`, { comment }),
  deleteComment: (projectId, recordId, commentId) => api.delete(`/projects/${projectId}/progress/${recordId}/comments/${commentId}`),
  addCommentAsTask: (projectId, recordId, commentId) =>
    api.post(`/projects/${projectId}/progress/${recordId}/comments/${commentId}/add-task`),
  addEvaluationAsTask: (projectId, recordId, body) =>
    api.post(`/projects/${projectId}/progress/${recordId}/add-evaluation-task`, body || {}),
};

export const settingsApi = {
  getMailStatus: () => api.get('/settings/mail-status'),
  listActivityNotifications: () => api.get('/settings/activity-notifications'),
  createActivityNotification: (data) => api.post('/settings/activity-notifications', data),
  updateActivityNotification: (id, data) => api.put(`/settings/activity-notifications/${id}`, data),
  deleteActivityNotification: (id) => api.delete(`/settings/activity-notifications/${id}`),
};

export const groupsApi = {
  getAll: () => api.get('/groups'),
  getById: (id) => api.get(`/groups/${id}`),
  create: (data) => api.post('/groups', data),
  update: (id, data) => api.put(`/groups/${id}`, data),
  delete: (id) => api.delete(`/groups/${id}`),
  addMember: (groupId, userId) => api.post(`/groups/${groupId}/members`, { user_id: userId }),
  removeMember: (groupId, userId) => api.delete(`/groups/${groupId}/members/${userId}`),
};

export const favoritesApi = {
  getAll: () => api.get('/favorites'),
  add: (path, label) => api.post('/favorites', { path, label }),
  delete: (id) => api.delete(`/favorites/${id}`),
  reorder: (order) => api.put('/favorites/reorder', { order }),
};

/** ログインユーザー専用の個人 ToDo（プロジェクトタスクとは別） */
export const myTodosApi = {
  getAll: () => api.get('/my-todos'),
  create: (data) => api.post('/my-todos', data),
  update: (id, data) => api.put(`/my-todos/${id}`, data),
  delete: (id) => api.delete(`/my-todos/${id}`),
  reorder: (order) => api.put('/my-todos/reorder', { order }),
};

/** 要望の投稿は全員。一覧 GET は管理者のみ（403 時は呼び出さないこと） */
export const featureRequestsApi = {
  create: (data) => api.post('/feature-requests', data),
  listAll: () => api.get('/feature-requests'),
};
