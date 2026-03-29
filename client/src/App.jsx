import { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, Drawer, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Box, IconButton, Menu, MenuItem, Avatar, Tooltip, Divider,
} from '@mui/material';
import FavoriteToggleButton from './components/FavoriteToggleButton';
import FavoritesSidebarSection from './components/FavoritesSidebarSection';
import { favoritesApi } from './api';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FolderIcon from '@mui/icons-material/Folder';
import AssignmentIcon from '@mui/icons-material/Assignment';
import PeopleIcon from '@mui/icons-material/People';
import GroupIcon from '@mui/icons-material/Group';
import HistoryIcon from '@mui/icons-material/History';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import ChecklistRtlIcon from '@mui/icons-material/ChecklistRtl';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import FeedbackOutlinedIcon from '@mui/icons-material/FeedbackOutlined';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Members from './pages/Members';
import Groups from './pages/Groups';
import Login from './pages/Login';
import Register from './pages/Register';
import ChangePassword from './pages/ChangePassword';
import ForgotPassword from './pages/ForgotPassword';
import PhaseGate from './pages/PhaseGate';
import ProgressTracking from './pages/ProgressTracking';
import PhaseProgressTabLayout from './pages/PhaseProgressTabLayout';
import TaskList from './pages/TaskList';
import ActivityHistory from './pages/ActivityHistory';
import NotificationSettings from './pages/NotificationSettings';
import MyTodos from './pages/MyTodos';
import Manual from './pages/Manual';
import FeatureRequests from './pages/FeatureRequests';
import { getStoredUser, clearAuth, authApi, saveAuth, getToken } from './auth';

function AdminRoute({ children }) {
  const u = getStoredUser();
  if (!u?.is_admin) {
    return <Navigate to="/" replace />;
  }
  return children;
}

const DRAWER_WIDTH = 220;

const navItems = [
  { text: 'ダッシュボード', icon: <DashboardIcon />, path: '/' },
  { text: 'プロジェクト一覧', icon: <FolderIcon />, path: '/projects' },
  { text: 'タスク一覧', icon: <AssignmentIcon />, path: '/tasks' },
  { text: 'マイToDo', icon: <ChecklistRtlIcon />, path: '/my-todos' },
  { text: '操作履歴', icon: <HistoryIcon />, path: '/activity-history' },
  { text: '通知設定', icon: <NotificationsActiveIcon />, path: '/settings/notifications' },
  { text: 'グループ', icon: <GroupIcon />, path: '/groups' },
  { text: 'メンバー', icon: <PeopleIcon />, path: '/members' },
];

/** サイドバー表示・専用画面は管理者のみ（プロジェクト内の担当者・グループ選択用 API は別途一般も利用可） */
const ADMIN_ONLY_NAV_PATHS = new Set([
  '/activity-history',
  '/settings/notifications',
  '/groups',
  '/members',
]);

function NavList() {
  const location = useLocation();
  const stored = getStoredUser();
  const visibleNavItems = navItems.filter((item) => {
    if (ADMIN_ONLY_NAV_PATHS.has(item.path)) return Boolean(stored?.is_admin);
    return true;
  });
  const isSelected = (path) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/tasks') return location.pathname === '/tasks';
    if (path === '/my-todos') return location.pathname === '/my-todos';
    if (path === '/activity-history') return location.pathname === '/activity-history';
    if (path === '/settings/notifications') return location.pathname === '/settings/notifications';
    return location.pathname.startsWith(path);
  };
  return (
    <List sx={{ px: 1, py: 1.5 }}>
      {visibleNavItems.map((item) => {
        const selected = isSelected(item.path);
        return (
          <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              component={Link}
              to={item.path}
              selected={selected}
              sx={{
                borderRadius: 2,
                py: 1.1,
                textDecoration: 'none',
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { bgcolor: 'primary.dark' },
                  '& .MuiListItemIcon-root': { color: 'inherit' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 42, color: 'inherit' }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{ variant: 'body2', fontWeight: selected ? 600 : 500 }}
              />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}

function AppLayout({ user, onLogout, onUserSync }) {
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState(null);
  const [favorites, setFavorites] = useState([]);

  const refreshFavorites = useCallback(() => {
    favoritesApi
      .getAll()
      .then((res) => setFavorites(Array.isArray(res.data) ? res.data : []))
      .catch(() => setFavorites([]));
  }, []);

  useEffect(() => {
    refreshFavorites();
  }, [refreshFavorites]);

  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((res) => {
        if (cancelled) return;
        const d = res.data;
        onUserSync({
          id: d.id,
          name: d.name,
          email: d.email,
          is_admin: Boolean(d.is_admin),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [onUserSync]);

  const handleLogout = () => {
    clearAuth();
    onLogout();
    setAnchorEl(null);
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" color="primary" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ minHeight: 56 }}>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1, fontWeight: 600, letterSpacing: 0.2 }}>
            PMO Management System
          </Typography>
          <Tooltip title="操作マニュアル">
            <IconButton color="inherit" component={Link} to="/manual" aria-label="操作マニュアル" size="medium">
              <HelpOutlineIcon />
            </IconButton>
          </Tooltip>
          <FavoriteToggleButton favorites={favorites} onFavoritesChange={refreshFavorites} />
          <IconButton color="inherit" onClick={(e) => setAnchorEl(e.currentTarget)}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.dark', fontSize: 14 }}>
              {user?.name?.charAt(0) || <AccountCircleIcon />}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
            <MenuItem disabled>
              <Typography variant="body2">{user?.name}</Typography>
            </MenuItem>
            <MenuItem component={Link} to="/change-password" onClick={() => setAnchorEl(null)}>
              パスワード変更
            </MenuItem>
            <MenuItem onClick={handleLogout}>ログアウト</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            height: '100%',
          },
        }}
      >
        <Toolbar sx={{ minHeight: 56 }} />
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <NavList />
            <FavoritesSidebarSection favorites={favorites} onFavoritesChange={refreshFavorites} />
          </Box>
          <Divider />
          <List sx={{ px: 1, py: 1, flexShrink: 0 }}>
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                to="/feature-requests"
                selected={location.pathname === '/feature-requests'}
                sx={{
                  borderRadius: 2,
                  py: 1.1,
                  textDecoration: 'none',
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': { bgcolor: 'primary.dark' },
                    '& .MuiListItemIcon-root': { color: 'inherit' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 42, color: 'inherit' }}>
                  <FeedbackOutlinedIcon />
                </ListItemIcon>
                <ListItemText
                  primary="要望の入力"
                  primaryTypographyProps={{
                    variant: 'body2',
                    fontWeight: location.pathname === '/feature-requests' ? 600 : 500,
                  }}
                />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, sm: 3 }, bgcolor: 'background.default', width: 1, minWidth: 0 }}>
        <Toolbar sx={{ minHeight: 56 }} />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/tasks" element={<TaskList />} />
          <Route path="/my-todos" element={<MyTodos />} />
          <Route path="/manual" element={<Manual />} />
          <Route path="/feature-requests" element={<FeatureRequests />} />
          <Route
            path="/activity-history"
            element={
              <AdminRoute>
                <ActivityHistory />
              </AdminRoute>
            }
          />
          <Route
            path="/settings/notifications"
            element={
              <AdminRoute>
                <NotificationSettings />
              </AdminRoute>
            }
          />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route element={<PhaseProgressTabLayout />}>
            <Route path="/projects/:id/phase-gates" element={<PhaseGate />} />
            <Route path="/projects/:id/progress" element={<ProgressTracking />} />
          </Route>
          <Route
            path="/members"
            element={
              <AdminRoute>
                <Members />
              </AdminRoute>
            }
          />
          <Route
            path="/groups"
            element={
              <AdminRoute>
                <Groups />
              </AdminRoute>
            }
          />
          <Route path="/change-password" element={<ChangePassword />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Box>
    </Box>
  );
}

export default function App() {
  const [user, setUser] = useState(getStoredUser());

  const handleLogin = (u) => setUser(u);
  const handleLogout = () => setUser(null);
  const handleUserSync = useCallback((u) => {
    const t = getToken();
    if (t) saveAuth(t, u);
    setUser(u);
  }, []);

  return (
    <BrowserRouter>
      {user ? (
        <AppLayout user={user} onLogout={handleLogout} onUserSync={handleUserSync} />
      ) : (
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
