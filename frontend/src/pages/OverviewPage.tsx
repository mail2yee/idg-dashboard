import { Box, Grid, Stack, Chip, Typography } from '@mui/material'
import HeadlineIndexCard from '../components/HeadlineIndexCard'
import MaturityDistributionChart from '../components/MaturityDistributionChart'
import DomainRankingChart from '../components/DomainRankingChart'
import LeaderboardSection from '../components/LeaderboardSection'
import SubjectTable from '../components/SubjectTable'
import { useStore } from '../state/store'

export default function OverviewPage() {
  const selectedDomain = useStore((s) => s.selectedDomain)
  const scoreRange = useStore((s) => s.scoreRange)
  const highlightedDomains = useStore((s) => s.highlightedDomains)
  const clearFilters = useStore((s) => s.clearFilters)

  const hasActiveFilter = selectedDomain || scoreRange || highlightedDomains.length > 0

  return (
    <Box sx={{ p: 3, maxWidth: 1280, mx: 'auto' }}>
      {hasActiveFilter && (
        <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            篩選中:
          </Typography>
          {selectedDomain && <Chip size="small" label={`Domain: ${selectedDomain}`} onDelete={() => useStore.getState().setSelectedDomain(null)} />}
          {scoreRange && (
            <Chip
              size="small"
              label={`Score: ${scoreRange[0]}-${scoreRange[1]}`}
              onDelete={() => useStore.getState().setScoreRange(null)}
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
