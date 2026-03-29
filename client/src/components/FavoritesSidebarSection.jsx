import { useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  IconButton,
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import CloseIcon from '@mui/icons-material/Close';
import { favoritesApi } from '../api';
import { getStoredUser } from '../auth';

const ADMIN_ONLY_PATH_PREFIXES = [
  '/activity-history',
  '/settings/notifications',
  '/groups',
  '/members',
];

function favoriteLinkAllowed(path) {
  const base = path.split(/[?#]/)[0];
  if (!getStoredUser()?.is_admin) {
    return !ADMIN_ONLY_PATH_PREFIXES.some((pre) => base === pre || base.startsWith(`${pre}/`));
  }
  return true;
}

export default function FavoritesSidebarSection({ favorites, onFavoritesChange }) {
  const location = useLocation();
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  const applyReorder = async (nextList) => {
    const order = nextList.map((x) => x.id);
    try {
      await favoritesApi.reorder(order);
      onFavoritesChange();
    } catch {
      onFavoritesChange();
    }
  };

  const handleDropBefore = async (targetId, e) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = e.dataTransfer.getData('text/plain');
    setDragId(null);
    setOverId(null);
    if (!draggedId || draggedId === targetId) return;
    const without = favorites.filter((f) => f.id !== draggedId);
    const targetIdx = without.findIndex((f) => f.id === targetId);
    const dragged = favorites.find((f) => f.id === draggedId);
    if (!dragged || targetIdx < 0) return;
    const next = [...without.slice(0, targetIdx), dragged, ...without.slice(targetIdx)];
    await applyReorder(next);
  };

  const handleDropEnd = async (e) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    setDragId(null);
    setOverId(null);
    if (!draggedId) return;
    const rest = favorites.filter((f) => f.id !== draggedId);
    const dragged = favorites.find((f) => f.id === draggedId);
    if (!dragged) return;
    const next = [...rest, dragged];
    await applyReorder(next);
  };

  const removeOne = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await favoritesApi.delete(id);
      onFavoritesChange();
    } catch {
      onFavoritesChange();
    }
  };

  if (!favorites.length) {
    return (
      <Box sx={{ px: 1.5, py: 1, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
          お気に入り
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4 }}>
          上部のハートを押すと、ここにショートカットが追加されます。左の ≡ をドラッグして並べ替えできます。
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 1, pb: 1 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ px: 1.5, display: 'block', mb: 0.5 }}>
        お気に入り
      </Typography>
      <List dense disablePadding sx={{ px: 0.5 }}>
        {favorites.map((f) => {
          const allowed = favoriteLinkAllowed(f.path);
          const selected = location.pathname + (location.search || '') + (location.hash || '') === f.path;
          const isOver = overId === f.id && dragId && dragId !== f.id;
          return (
            <ListItem
              key={f.id}
              disablePadding
              secondaryAction={
                <IconButton
                  edge="end"
                  size="small"
                  aria-label="お気に入りから削除"
                  onClick={(e) => removeOne(e, f.id)}
                  sx={{ mr: 0.25 }}
                >
                  <CloseIcon sx={{ fontSize: 18 }} />
                </IconButton>
              }
              sx={{
                mb: 0.25,
                borderTop: isOver ? 2 : 0,
                borderColor: 'primary.main',
                borderRadius: 1,
              }}
            >
              <ListItemButton
                component={allowed ? RouterLink : 'div'}
                {...(allowed ? { to: f.path } : {})}
                disabled={!allowed}
                selected={selected && allowed}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragId && dragId !== f.id) setOverId(f.id);
                }}
                onDragLeave={() => setOverId((cur) => (cur === f.id ? null : cur))}
                onDrop={(e) => handleDropBefore(f.id, e)}
                title={!allowed ? 'このリンクは管理者のみ開けます' : undefined}
                sx={{
                  borderRadius: 2,
                  pr: 5,
                  opacity: dragId === f.id ? 0.45 : 1,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': { bgcolor: 'primary.dark' },
                    '& .MuiListItemIcon-root': { color: 'inherit' },
                  },
                }}
              >
                <ListItemIcon
                  sx={{ minWidth: 32, color: 'text.secondary' }}
                  onClick={(e) => e.preventDefault()}
                >
                  <Box
                    component="span"
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation();
                      setDragId(f.id);
                      e.dataTransfer.setData('text/plain', f.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverId(null);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    sx={{ cursor: 'grab', display: 'inline-flex', alignItems: 'center', touchAction: 'none' }}
                  >
                    <DragIndicatorIcon fontSize="small" />
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={f.label}
                  primaryTypographyProps={{ variant: 'body2', noWrap: true, title: f.path }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Box
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={handleDropEnd}
        sx={{
          minHeight: 12,
          mx: 1,
          mb: 0.5,
          borderRadius: 1,
          border: '1px dashed',
          borderColor: dragId ? 'divider' : 'transparent',
        }}
      />
    </Box>
  );
}
