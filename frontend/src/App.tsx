import { ThemeProvider, CssBaseline, AppBar, Toolbar, Typography, IconButton, Box, Tabs, Tab, ToggleButtonGroup, ToggleButton } from '@mui/material'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import { useEffect, useMemo, useState } from 'react'
import { buildMuiTheme } from './theme/muiTheme'
import { useStore } from './state/store'
import { api } from './api/client'
import { useT } from './i18n/useT'
import OverviewPage from './pages/OverviewPage'
import TrendsPage from './pages/TrendsPage'
import KpiBreakdownPage from './pages/KpiBreakdownPage'
import GovernancePage from './pages/GovernancePage'
import SubjectDetailDrawer from './components/SubjectDetailDrawer'
import DomainDetailDrawer from './components/DomainDetailDrawer'
import OwnerTeamDetailDrawer from './components/OwnerTeamDetailDrawer'
import AgentPanel from './components/AgentPanel'

export default function App() {
  const mode = useStore((s) => s.mode)
  const toggleMode = useStore((s) => s.toggleMode)
  const locale = useStore((s) => s.locale)
  const setLocale = useStore((s) => s.setLocale)
  const setDimensionConfig = useStore((s) => s.setDimensionConfig)
  const setLevelConfig = useStore((s) => s.setLevelConfig)
  const theme = useMemo(() => buildMuiTheme(mode), [mode])
  const [tab, setTab] = useState<'overview' | 'trends' | 'kpi' | 'governance'>('overview')
  const t = useT()

  useEffect(() => {
    api.configDimensions().then((res) => setDimensionConfig(res.dimensions, res.max_score))
    api.configLevels().then((res) => setLevelConfig(res.levels, res.max_level))
  }, [setDimensionConfig, setLevelConfig])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>
            {t('app.title')}
          </Typography>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 'auto' }}>
            <Tab value="overview" label={t('nav.overview')} sx={{ minHeight: 'auto' }} />
            <Tab value="trends" label={t('nav.trends')} sx={{ minHeight: 'auto' }} />
            <Tab value="kpi" label={t('nav.kpi')} sx={{ minHeight: 'auto' }} />
            <Tab value="governance" label={t('nav.governance')} sx={{ minHeight: 'auto' }} />
          </Tabs>
          <ToggleButtonGroup
            size="small"
            value={locale}
            exclusive
            onChange={(_, v) => v && setLocale(v)}
            sx={{ ml: 2 }}
          >
            <ToggleButton value="en" sx={{ px: 1.25, py: 0.25, fontSize: 12 }}>EN</ToggleButton>
            <ToggleButton value="zh" sx={{ px: 1.25, py: 0.25, fontSize: 12 }}>中</ToggleButton>
          </ToggleButtonGroup>
          <IconButton onClick={toggleMode} sx={{ ml: 1 }}>
            {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        {tab === 'overview' && <OverviewPage />}
        {tab === 'trends' && <TrendsPage />}
        {tab === 'kpi' && <KpiBreakdownPage />}
        {tab === 'governance' && <GovernancePage />}
      </Box>
      <SubjectDetailDrawer />
      <DomainDetailDrawer />
      <OwnerTeamDetailDrawer />
      <AgentPanel />
    </ThemeProvider>
  )
}
