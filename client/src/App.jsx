import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import {
  AppBar, Toolbar, Typography, Drawer, List, ListItem, ListItemIcon,
  ListItemText, Box, CssBaseline, IconButton, Menu, MenuItem, Avatar
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FolderIcon from '@mui/icons-material/Folder';
import PeopleIcon from '@mui/icons-material/People';
import GroupIcon from '@mui/icons-material/Group';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
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
import { getStoredUser, clearAuth } from './auth';

const DRAWER_WIDTH = 220;

const navItems = [
  { text: 'ダッシュボード', icon: <DashboardIcon />, path: '/' },
  { text: 'プロジェクト', icon: <FolderIcon />, path: '/projects' },
  { text: 'グループ', icon: <GroupIcon />, path: '/groups' },
  { text: 'メンバー', icon: <PeopleIcon />, path: '/members' },
];

function NavList() {
  const location = useLocation();
  const isSelected = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
  return (
    <List>
      {navItems.map((item) => (
        <ListItem
          key={item.path}
          component={Link}
          to={item.path}
          selected={isSelected(item.path)}
          sx={{ color: 'inherit', textDecoration: 'none', '&.Mui-selected': { bgcolor: 'primary.light', color: 'white' } }}
        >
          <ListItemIcon sx={{ color: 'inherit' }}>{item.icon}</ListItemIcon>
          <ListItemText primary={item.text} />
        </ListItem>
      ))}
    </List>
  );
}

function AppLayout({ user, onLogout }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useLocation();

  const handleLogout = () => {
    clearAuth();
    onLogout();
    setAnchorEl(null);
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>PMO Management System</Typography>
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
      <Drawer variant="permanent" sx={{ width: DRAWER_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}>
        <Toolbar />
        <NavList />
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/projects/:id/phase-gates" element={<PhaseGate />} />
          <Route path="/projects/:id/progress" element={<ProgressTracking />} />
          <Route path="/members" element={<Members />} />
          <Route path="/groups" element={<Groups />} />
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

  return (
    <BrowserRouter>
      {user ? (
        <AppLayout user={user} onLogout={handleLogout} />
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
