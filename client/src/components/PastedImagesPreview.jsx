import { Box, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useImageViewer } from '../context/ImageViewerContext.jsx';

/** 投稿前の貼り付け画像サムネイル */
export default function PastedImagesPreview({ images, onRemove, max = 8 }) {
  const { showImage } = useImageViewer();
  if (!images?.length) return null;
  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
        貼り付け画像 ({images.length}/{max}) — クリックで拡大、× で削除
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {images.map((src, i) => (
          <Box
            key={i}
            sx={{
              position: 'relative',
              width: 72,
              height: 72,
              flexShrink: 0,
            }}
          >
            <Box
              component="img"
              src={src}
              alt=""
              title="クリックで拡大表示"
              onClick={() => showImage(src)}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                cursor: 'pointer',
                display: 'block',
                '&:hover': { opacity: 0.9 },
              }}
            />
            <IconButton
              size="small"
              aria-label="画像を削除"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(i);
              }}
              sx={{
                position: 'absolute',
                top: -10,
                right: -10,
                bgcolor: 'background.paper',
                boxShadow: 1,
                '&:hover': { bgcolor: 'grey.100' },
              }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
