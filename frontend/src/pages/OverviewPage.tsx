import { useEffect, useState } from 'react'
import { Box, Grid, Stack, Chip, Typography, Card, CardContent } from '@mui/material'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import HeadlineIndexCard from '../components/HeadlineIndexCard'
import MaturityDistributionChart from '../components/MaturityDistributionChart'
import DomainRankingChart from '../components/DomainRankingChart'
import LeaderboardSection from '../components/LeaderboardSection'
import SubjectTable from '../components/SubjectTable'
import { useStore } from '../state/store'
import { api } from '../api/client'

function CountTile({ icon, label, count }: { icon: React.ReactNode; label: string; count: number | null }) {
  return (
    <Card variant="outlined" sx={{ flex: 1, minWidth: 160 }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, '&:last-child': { pb: 2 } }}>
        {icon}
        <Box>
          <Typography variant="h6" sx={{ lineHeight: 1.1 }}>
            {count ?? '—'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
        </Box>
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

  useEffect(() => {
    api.domainRanking().then((res) => setDomainCount(res.domains.length))
    api.subjects({}).then((res) => setSubjectCount(res.subjects.length))
  }, [])

  const hasActiveFilter = selectedDomain || levelRange || highlightedDomains.length > 0

  return (
    <Box sx={{ p: 3, maxWidth: 1280, mx: 'auto' }}>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <CountTile icon={<AccountTreeIcon color="action" />} label="Domains" count={domainCount} />
        <CountTile icon={<Inventory2Icon color="action" />} label="Data Subjects" count={subjectCount} />
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
