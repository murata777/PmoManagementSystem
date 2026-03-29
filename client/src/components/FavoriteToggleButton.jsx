import { IconButton, Tooltip } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { useLocation } from 'react-router-dom';
import { favoritePathFromLocation, deriveFavoriteLabel } from '../utils/favoritePath';
import { favoritesApi } from '../api';

export default function FavoriteToggleButton({ favorites, onFavoritesChange }) {
  const location = useLocation();
  const pathKey = favoritePathFromLocation(location);
  const match = favorites.find((f) => f.path === pathKey);
  const isFav = Boolean(match);

  const handleClick = async () => {
    try {
      if (match) {
        await favoritesApi.delete(match.id);
      } else {
        await favoritesApi.add(
          pathKey,
          deriveFavoriteLabel(location.pathname, location.search || '')
        );
      }
      onFavoritesChange();
    } catch {
      /* 401 は api インターセプタでログインへ */
    }
  };

  return (
    <Tooltip title={isFav ? 'お気に入りから削除' : 'お気に入りに追加'}>
      <span>
        <IconButton color="inherit" onClick={handleClick} aria-label={isFav ? 'お気に入りから削除' : 'お気に入りに追加'} size="medium">
          {isFav ? <FavoriteIcon /> : <FavoriteBorderIcon />}
        </IconButton>
      </span>
    </Tooltip>
  );
}
