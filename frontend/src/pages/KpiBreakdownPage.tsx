import { useEffect, useState } from 'react'
import { Box, Card, CardContent, Typography, Stack, ToggleButtonGroup, ToggleButton, Grid, LinearProgress } from '@mui/material'
import { api, type DomainDimensionBreakdown, type Subject } from '../api/client'
import { useStore } from '../state/store'
import DimensionHeatmap from '../components/DimensionHeatmap'
import { categorical } from '../theme/palette'
import InfoTooltip from '../components/InfoTooltip'
import { useT } from '../i18n/useT'

type Scope = 'domain' | 'subject'

export default function KpiBreakdownPage() {
  const t = useT()
  const mode = useStore((s) => s.mode)
  const dims = useStore((s) => s.dimensions)
  const setSelectedDomainDetail = useStore((s) => s.setSelectedDomainDetail)
  const setSelectedSubjectId = useStore((s) => s.setSelectedSubjectId)
  const [scope, setScope] = useState<Scope>('domain')
  const [domains, setDomains] = useState<DomainDimensionBreakdown[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])

  useEffect(() => {
    api.domainsDimensionBreakdown().then((res) => setDomains(res.domains as unknown as DomainDimensionBreakdown[]))
    api.subjects({}).then((res) => setSubjects(res.subjects))
  }, [])

  const orgAverage: Record<string, number> = {}
  dims.forEach((d) => {
    const vals = domains.map((row) => (row as unknown as Record<string, number>)[d.key])
    orgAverage[d.key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  })

  const rows =
    scope === 'domain'
      ? domains.map((d) => ({ label: d.domain, values: d as unknown as Record<string, number> }))
      : subjects
          .filter((s) => s.sub_scores)
          .map((s) => ({ label: s.name, values: s.sub_scores as Record<string, number> }))

  return (
    <Box sx={{ p: 3, maxWidth: 1280, mx: 'auto' }}>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={0} sx={{ alignItems: 'center' }}>
            <Typography variant="subtitle1" gutterBottom sx={{ mb: 0 }}>
              {t('kpi.orgAverage.title')}
            </Typography>
            <InfoTooltip text={t('kpi.orgAverage.tooltip')} />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('kpi.orgAverage.subtitle', { n: dims.length })}
          </Typography>
          <Grid container spacing={2}>
            {dims.map((d) => (
              <Grid size={{ xs: 12, sm: 6, md: 12 / dims.length }} key={d.key}>
                <Typography variant="caption" color="text.secondary">
                  {d.label}
                </Typography>
                <Typography variant="h6">{(orgAverage[d.key] ?? 0).toFixed(2)}</Typography>
                <LinearProgress
                  variant="determinate"
                  value={(orgAverage[d.key] ?? 0) * 100}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: 'action.hover',
                    '& .MuiLinearProgress-bar': { bgcolor: categorical[mode][0], borderRadius: 3 },
                  }}
                />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ mb: 1, alignItems: 'center' }}>
            <Stack direction="row" spacing={0} sx={{ alignItems: 'center' }}>
              <Typography variant="subtitle1">
                {t('kpi.breakdown.title')}
                {t(scope === 'domain' ? 'trends.scopeByDomain' : 'trends.scopeBySubject')}
              </Typography>
              <InfoTooltip text={t('kpi.breakdown.tooltip')} />
            </Stack>
            <ToggleButtonGroup size="small" value={scope} exclusive onChange={(_, v) => v && setScope(v)}>
              <ToggleButton value="domain">{t('trends.scopeByDomain')}</ToggleButton>
              <ToggleButton value="subject">{t('trends.scopeBySubject')}</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
            {t('kpi.breakdown.caption')}
          </Typography>
          <DimensionHeatmap
            rows={rows}
            dims={dims}
            mode={mode}
            onRowClick={(label) =>
              scope === 'domain'
                ? setSelectedDomainDetail(label)
                : setSelectedSubjectId(subjects.find((s) => s.name === label)?.id ?? null)
            }
          />
        </CardContent>
      </Card>
    </Box>
  )
}
