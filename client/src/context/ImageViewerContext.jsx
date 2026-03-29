import { createContext, useCallback, useContext, useState } from 'react';
import { Dialog, DialogContent, IconButton, Box } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const ImageViewerContext = createContext(null);

export function ImageViewerProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState('');

  const showImage = useCallback((url) => {
    if (!url || typeof url !== 'string') return;
    setSrc(url);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setSrc('');
  }, []);

  return (
    <ImageViewerContext.Provider value={{ showImage }}>
      {children}
      <Dialog
        open={open}
        onClose={close}
        maxWidth={false}
        fullWidth
        PaperProps={{
          onClick: (e) => e.stopPropagation(),
          sx: {
            bgcolor: 'rgba(18,18,18,0.97)',
            m: { xs: 0.5, sm: 2 },
            maxWidth: 'min(100vw - 16px, 1600px)',
            maxHeight: '98vh',
            overflow: 'hidden',
          },
        }}
        slotProps={{ backdrop: { sx: { bgcolor: 'rgba(0,0,0,0.75)' } } }}
      >
        <IconButton
          onClick={close}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: 'common.white',
            zIndex: 1,
            bgcolor: 'rgba(255,255,255,0.08)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' },
          }}
          aria-label="閉じる"
        >
          <CloseIcon />
        </IconButton>
        <DialogContent
          sx={{
            p: 2,
            pt: 5,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 120,
          }}
        >
          {src ? (
            <Box
              component="img"
              src={src}
              alt=""
              sx={{
                maxWidth: '100%',
                maxHeight: { xs: '85vh', sm: '88vh' },
                objectFit: 'contain',
                borderRadius: 1,
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </ImageViewerContext.Provider>
  );
}

export function useImageViewer() {
  const ctx = useContext(ImageViewerContext);
  if (!ctx) {
    throw new Error('useImageViewer must be used within ImageViewerProvider');
  }
  return ctx;
}
