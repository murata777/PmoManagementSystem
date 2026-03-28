import { Box, Typography } from '@mui/material';
import { decodeCommentStored } from '../utils/commentImages';
import { useImageViewer } from '../context/ImageViewerContext.jsx';

/** DB に保存されたコメント文字列（プレーン or JSON+画像）を表示 */
export default function CommentRichContent({ value, sx }) {
  const { showImage } = useImageViewer();
  const { text, images } = decodeCommentStored(value);
  return (
    <Box sx={sx}>
      {text ? (
        <Typography component="div" variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {text}
        </Typography>
      ) : null}
      {images.length > 0 ? (
        <Box
          sx={{
            mt: text ? 1 : 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            alignItems: 'flex-start',
          }}
        >
          {images.map((src, i) => (
            <Box
              key={i}
              component="img"
              src={src}
              alt=""
              role="button"
              tabIndex={0}
              title="クリックで拡大表示"
              onClick={() => showImage(src)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  showImage(src);
                }
              }}
              sx={{
                maxWidth: '100%',
                maxHeight: 360,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                objectFit: 'contain',
                bgcolor: 'grey.50',
                cursor: 'pointer',
                '&:hover': { opacity: 0.92, boxShadow: 2 },
                '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
              }}
            />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
