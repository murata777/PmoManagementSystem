import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import './index.css';
import App from './App.jsx';
import { appTheme } from './theme';
import { ImageViewerProvider } from './context/ImageViewerContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
      <ImageViewerProvider>
        <App />
      </ImageViewerProvider>
    </ThemeProvider>
  </StrictMode>,
);
