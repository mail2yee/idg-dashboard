import { useEffect, useMemo, useState } from 'react'
import { Box, Grid, Stack, Chip, Typography, Card, CardContent } from '@mui/material'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import ReactECharts from 'echarts-for-react'
import HeadlineIndexCard from '../components/HeadlineIndexCard'
import MaturityDistributionChart from '../components/MaturityDistributionChart'
import DomainRankingChart from '../components/DomainRankingChart'
import LeaderboardSection from '../components/LeaderboardSection'
import SubjectTable from '../components/SubjectTable'
import { useStore } from '../state/store'
import { api } from '../api/client'
import { chrome, categorical } from '../theme/palette'

function CountTile({
  icon,
  label,
  count,
  trend,
  newCount,
  windowDays,
}: {
  icon: React.ReactNode
  label: string
  count: number | null
  trend?: number[]
  newCount?: number
  windowDays?: number
}) {
  const mode = useStore((s) => s.mode)
  const c = chrome[mode]
  const accent = categorical[mode][0]

  const sparklineOption = useMemo(
    () => ({
      animation: false,
      grid: { left: 0, right: 0, top: 4, bottom: 0 },
      xAxis: { type: 'category', show: false, data: (trend ?? []).map((_, i) => i) },
      yAxis: { type: 'value', show: false, min: (v: { min: number }) => Math.max(0, v.min - 1) },
      tooltip: { show: false },
      series: [
        { type: 'line', data: trend ?? [], showSymbol: false, lineStyle: { width: 2, color: c.textMuted } },
        {
          type: 'line',
          data: (trend ?? []).map((v, i) => (i === (trend?.length ?? 0) - 1 ? v : null)),
          showSymbol: true,
          symbolSize: 6,
          lineStyle: { width: 0 },
          itemStyle: { color: accent, borderColor: c.surface, borderWidth: 2 },
        },
      ],
    }),
    [trend, c, accent],
  )

  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 160 }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, '&:last-child': { pb: 2 } }}>
        {icon}
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
            {count ?? '—'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {label}
            {trend && newCount !== undefined ? ` · 近 ${windowDays} 天 +${newCount}` : ''}
          </Typography>
        </Box>
        {trend && trend.length > 1 && (
          <Box sx={{ width: 64, height: 28 }}>
            <ReactECharts option={sparklineOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

export default function OverviewPage() {
  const selectedDomain = useStore((s) => s.selectedDomain)
  const levelRange = useStore((s) => s.levelRange)
  const highlightedDomains = useStore((s) => s.highlightedDomains)
  const clearFilters = useStore((s) => s.clearFilters)
  const [domainCount, setDomainCount] = useState<number | null>(null)
  const [subjectCount, setSubjectCount] = useState<number | null>(null)
  const [subjectTrend, setSubjectTrend] = useState<number[]>([])
  const [newSubjects, setNewSubjects] = useState<{ count: number; windowDays: number } | null>(null)

  useEffect(() => {
    api.domainRanking().then((res) => setDomainCount(res.domains.length))
    api.subjects({}).then((res) => setSubjectCount(res.subjects.length))
    api.governanceSubjectGrowth().then((res) => {
      setSubjectTrend(res.total_trend)
      setNewSubjects({ count: res.new_subjects_total, windowDays: res.window_days })
    })
  }, [])

  const hasActiveFilter = selectedDomain || levelRange || highlightedDomains.length > 0

  return (
    <Box sx={{ p: 3, maxWidth: 1280, mx: 'auto' }}>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <CountTile icon={<AccountTreeIcon color="action" />} label="Domains" count={domainCount} />
        <CountTile
          icon={<Inventory2Icon color="action" />}
          label="Data Subjects"
          count={subjectCount}
          trend={subjectTrend}
          newCount={newSubjects?.count}
          windowDays={newSubjects?.windowDays}
        />
      </Stack>

      {hasActiveFilter && (
        <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            篩選中:
          </Typography>
          {selectedDomain && <Chip size="small" label={`Domain: ${selectedDomain}`} onDelete={() => useStore.getState().setSelectedDomain(null)} />}
          {levelRange && (
            <Chip
              size="small"
              label={levelRange[0] === levelRange[1] ? `Level: L${levelRange[0]}` : `Level: L${levelRange[0]}-L${levelRange[1]}`}
              onDelete={() => useStore.getState().setLevelRange(null)}
            />
          )}
          {highlightedDomains.length > 0 && (
            <Chip size="small" label={`AI 標示: ${highlightedDomains.join(', ')}`} onDelete={() => useStore.getState().setHighlightedDomains([])} />
          )}
          <Chip size="small" variant="outlined" label="清除全部" onClick={clearFilters} />
        </Stack>
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <HeadlineIndexCard />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <MaturityDistributionChart />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <DomainRankingChart />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <LeaderboardSection />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <SubjectTable />
        </Grid>
      </Grid>
    </Box>
  )
}
