import { ThemeProvider, CssBaseline, AppBar, Toolbar, Typography, IconButton, Box, Tabs, Tab } from '@mui/material'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import { useEffect, useMemo, useState } from 'react'
import { buildMuiTheme } from './theme/muiTheme'
import { useStore } from './state/store'
import { api } from './api/client'
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
  const setDimensionConfig = useStore((s) => s.setDimensionConfig)
  const setLevelConfig = useStore((s) => s.setLevelConfig)
  const theme = useMemo(() => buildMuiTheme(mode), [mode])
  const [tab, setTab] = useState<'overview' | 'trends' | 'kpi' | 'governance'>('overview')

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
            IDG Data Quality Dashboard
          </Typography>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 'auto' }}>
            <Tab value="overview" label="總覽" sx={{ minHeight: 'auto' }} />
            <Tab value="trends" label="週 / 月 / 年變化" sx={{ minHeight: 'auto' }} />
            <Tab value="kpi" label="KPI 拆解" sx={{ minHeight: 'auto' }} />
            <Tab value="governance" label="治理健康" sx={{ minHeight: 'auto' }} />
          </Tabs>
          <IconButton onClick={toggleMode} sx={{ ml: 2 }}>
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
