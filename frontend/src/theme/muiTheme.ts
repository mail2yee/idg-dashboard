import { createTheme } from '@mui/material/styles'
import { chrome, categorical, type Mode } from './palette'

export function buildMuiTheme(mode: Mode) {
  const c = chrome[mode]
  return createTheme({
    palette: {
      mode,
      primary: { main: categorical[mode][0] },
      background: { default: c.page, paper: c.surface },
      text: { primary: c.textPrimary, secondary: c.textSecondary },
      divider: c.gridline,
    },
    typography: {
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    },
    shape: { borderRadius: 10 },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: { border: `1px solid ${c.border}` },
        },
      },
    },
  })
}
