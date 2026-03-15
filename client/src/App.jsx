import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Drawer, List, ListItem, ListItemIcon, ListItemText, Box, CssBaseline } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FolderIcon from '@mui/icons-material/Folder';
import PeopleIcon from '@mui/icons-material/People';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Members from './pages/Members';

const DRAWER_WIDTH = 220;

const navItems = [
  { text: 'ダッシュボード', icon: <DashboardIcon />, path: '/' },
  { text: 'プロジェクト', icon: <FolderIcon />, path: '/projects' },
  { text: 'メンバー', icon: <PeopleIcon />, path: '/members' },
];

function NavList() {
  const location = useLocation();
  return (
    <List>
      {navItems.map((item) => (
        <ListItem
          key={item.path}
          component={Link}
          to={item.path}
          selected={location.pathname === item.path}
          sx={{ color: 'inherit', textDecoration: 'none', '&.Mui-selected': { bgcolor: 'primary.light', color: 'white' } }}
        >
          <ListItemIcon sx={{ color: 'inherit' }}>{item.icon}</ListItemIcon>
          <ListItemText primary={item.text} />
        </ListItem>
      ))}
    </List>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Box sx={{ display: 'flex' }}>
        <CssBaseline />
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
          <Toolbar>
            <Typography variant="h6" noWrap>PMO Management System</Typography>
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
            <Route path="/members" element={<Members />} />
          </Routes>
        </Box>
      </Box>
    </BrowserRouter>
  );
}
