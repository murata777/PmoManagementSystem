import { Box, Typography } from '@mui/material';
import { decodeCommentStored } from '../utils/commentImages';

/** DB に保存されたコメント文字列（プレーン or JSON+画像）を表示 */
export default function CommentRichContent({ value, sx }) {
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
              sx={{
                maxWidth: '100%',
                maxHeight: 360,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                objectFit: 'contain',
                bgcolor: 'grey.50',
              }}
            />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
