import { createTheme } from '@mui/material/styles';

/** アプリ全体の UI トーン（業務向け・読みやすさ優先） */
export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1565c0',
      light: '#5e92c3',
      dark: '#0d47a1',
    },
    secondary: {
      main: '#546e7a',
    },
    background: {
      default: '#f0f4f8',
      paper: '#ffffff',
    },
    divider: 'rgba(0, 0, 0, 0.08)',
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily:
      '"Segoe UI", system-ui, -apple-system, Roboto, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif',
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    button: { fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f0f4f8',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 10,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.06)',
          border: '1px solid rgba(0,0,0,0.06)',
          backgroundImage: 'none',
        },
      },
    },
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: '0 1px 0 rgba(0,0,0,0.08)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid',
          borderColor: 'rgba(0,0,0,0.08)',
          backgroundColor: '#f8fafc',
          backgroundImage: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          backgroundColor: 'rgba(0, 0, 0, 0.02)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 14,
        },
      },
    },
  },
});
