import { useEffect, useMemo, useState } from 'react'
import { Grid, Stack, Card, CardContent, Typography, Box } from '@mui/material'
import { api, type OrgSnapshot, type DomainTrendSummary } from '../../api/client'
import SparklineChart from './SparklineChart'
import MomentumTop3Panel, { type Top3Row } from './MomentumTop3Panel'
import MonthlyTrendChart from './MonthlyTrendChart'
import { useT } from '../../i18n/useT'

export default function MonthlyTrendView() {
  const t = useT()
  const [summary, setSummary] = useState<{ latest: OrgSnapshot; trend: OrgSnapshot[] } | null>(null)
  const [domains, setDomains] = useState<OrgSnapshot[] | null>(null)
  const [yearTrend, setYearTrend] = useState<DomainTrendSummary[] | null>(null)

  useEffect(() => {
    api.maturitySummary().then((res) => setSummary(res))
    api.domainRanking().then((res) => setDomains(res.domains))
    api.domainsTrendSummary('year').then((res) => setYearTrend(res.domains))
  }, [])

  const shareTop3: Top3Row[] = useMemo(() => {
    const all = domains ?? []
    const total = all.reduce((s, d) => s + d.subject_count, 0) || 1
    return [...all]
      .sort((a, b) => b.subject_count - a.subject_count)
      .slice(0, 3)
      .map((d) => ({
        domain: d.domain ?? '',
        secondaryLine: d.avg_maturity_level.toFixed(2),
        primaryText: `${((d.subject_count / total) * 100).toFixed(1)}%`,
        deltaText: Math.abs(d.wow_delta).toFixed(2),
        deltaPositive: d.wow_delta >= 0,
      }))
  }, [domains])

  const momentumTop3: Top3Row[] = useMemo(() => {
    const all = yearTrend ?? []
    return [...all]
      .sort((a, b) => b.yoy_delta - a.yoy_delta)
      .slice(0, 3)
      .map((d) => ({
        domain: d.domain,
        secondaryLine: d.avg_maturity_level.toFixed(2),
        primaryText: d.avg_maturity_level.toFixed(2),
        deltaText: Math.abs(d.yoy_delta).toFixed(2),
        deltaPositive: d.yoy_delta >= 0,
      }))
  }, [yearTrend])

  const momentumBottom3: Top3Row[] = useMemo(() => {
    const all = yearTrend ?? []
    return [...all]
      .sort((a, b) => a.yoy_delta - b.yoy_delta)
      .slice(0, 3)
      .map((d) => ({
        domain: d.domain,
        secondaryLine: d.avg_maturity_level.toFixed(2),
        primaryText: d.avg_maturity_level.toFixed(2),
        deltaText: Math.abs(d.yoy_delta).toFixed(2),
        deltaPositive: d.yoy_delta >= 0,
      }))
  }, [yearTrend])

  return (
    <>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 2.5 }}>
          <Stack spacing={2}>
            <StatSparklineCard
              label={t('reports.monthly.dataSubjects')}
              value={summary?.latest.subject_count ?? '—'}
              values={summary?.trend.map((s) => s.subject_count) ?? []}
            />
            <StatSparklineCard
              label={t('reports.monthly.maturityLevel')}
              value={summary?.latest.avg_maturity_level.toFixed(2) ?? '—'}
              values={summary?.trend.map((s) => s.avg_maturity_level) ?? []}
            />
          </Stack>
        </Grid>
        <Grid size={{ xs: 12, md: 3.17 }}>
          <MomentumTop3Panel title={t('reports.monthly.currentTop3')} rows={shareTop3} />
        </Grid>
        <Grid size={{ xs: 12, md: 3.16 }}>
          <MomentumTop3Panel title={t('reports.monthly.yearlyTop3')} rows={momentumTop3} />
        </Grid>
        <Grid size={{ xs: 12, md: 3.17 }}>
          <MomentumTop3Panel title={t('reports.monthly.yearlyBottom3')} rows={momentumBottom3} />
        </Grid>
      </Grid>

      <MonthlyTrendChart />
    </>
  )
}

function StatSparklineCard({ label, value, values }: { label: string; value: string | number; values: number[] }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography sx={{ fontSize: 28, fontWeight: 600, lineHeight: 1.2 }}>{value}</Typography>
        <Box sx={{ mt: 0.5 }}>
          <SparklineChart values={values} />
        </Box>
      </CardContent>
    </Card>
  )
}
