import { useEffect, useMemo, useState } from 'react'
import { Box, Grid, Stack, Typography, Breadcrumbs, TextField, MenuItem, Card, CardContent } from '@mui/material'
import { api, type OrgSnapshot } from '../api/client'
import { DOMAIN_ORDER } from '../theme/palette'
import ProductSuiteDonutChart from '../components/reports/ProductSuiteDonutChart'
import GovernanceKpiGrid from '../components/reports/GovernanceKpiGrid'
import DimensionBreakdownChart from '../components/reports/DimensionBreakdownChart'
import { useT } from '../i18n/useT'

export default function ReportsPage() {
  const t = useT()
  const [domainFilter, setDomainFilter] = useState('')
  const [global, setGlobal] = useState<OrgSnapshot | null>(null)
  const [domains, setDomains] = useState<OrgSnapshot[] | null>(null)

  useEffect(() => {
    api.maturitySummary().then((res) => setGlobal(res.latest))
    api.domainRanking().then((res) => setDomains(res.domains))
  }, [])

  const filter = domainFilter || null

  const kpi = useMemo(() => {
    if (!filter) {
      return {
        domainCount: domains?.length ?? 0,
        subjectCount: global?.subject_count ?? 0,
        maturity: global?.avg_maturity_level ?? 0,
      }
    }
    const d = domains?.find((x) => x.domain === filter)
    return {
      domainCount: 1,
      subjectCount: d?.subject_count ?? 0,
      maturity: d?.avg_maturity_level ?? 0,
    }
  }, [filter, domains, global])

  return (
    <Box sx={{ p: 3, maxWidth: 1280, mx: 'auto' }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }} spacing={2}>
        <Box>
          <Breadcrumbs sx={{ mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {t('reports.breadcrumb')}
            </Typography>
          </Breadcrumbs>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {t('reports.title')}
          </Typography>
        </Box>
        <TextField
          size="small"
          select
          label={t('reports.domainFilterLabel')}
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          sx={{ width: 180 }}
        >
          <MenuItem value="">{t('reports.domainFilterAll')}</MenuItem>
          {DOMAIN_ORDER.map((d) => (
            <MenuItem key={d} value={d}>
              {d}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <KpiTile label={t('reports.kpi.domain')} value={kpi.domainCount} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <KpiTile label={t('reports.kpi.subject')} value={kpi.subjectCount} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <KpiTile label={t('reports.kpi.maturity')} value={kpi.maturity.toFixed(1)} accent />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <ProductSuiteDonutChart domainFilter={filter} />
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <GovernanceKpiGrid domainFilter={filter} />
        </Grid>
        <Grid size={12}>
          <DimensionBreakdownChart domainFilter={filter} />
        </Grid>
      </Grid>
    </Box>
  )
}

function KpiTile({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography sx={{ fontSize: 34, fontWeight: 600, lineHeight: 1.2, color: accent ? 'error.main' : 'text.primary' }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  )
}
