import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, Typography, Box, Stack, TextField, MenuItem, Checkbox, ListItemText } from '@mui/material'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import { AgCharts } from 'ag-charts-react'
import type { AgCartesianChartOptions } from 'ag-charts-community'
import { api, type DomainTrendSummary, type OrgSnapshot } from '../../api/client'
import { useStore } from '../../state/store'
import { chrome, categorical, domainColor, status, DOMAIN_ORDER } from '../../theme/palette'
import { FONT_FAMILY } from '../../theme/echartsTheme'
import { useT } from '../../i18n/useT'

function monthBucket(isoDate: string): string {
  return isoDate.slice(0, 4) + isoDate.slice(5, 7)
}

// Keeps the last snapshot in each calendar month, so a chart driven by this
// app's weekly history reads as a monthly trend (matching the Figma
// reference's cadence) without the backend needing a separate monthly
// rollup endpoint.
function bucketByMonth(dates: string[], values: number[]): { month: string; value: number }[] {
  const byMonth = new Map<string, number>()
  dates.forEach((d, i) => byMonth.set(monthBucket(d), values[i]))
  return [...byMonth.entries()].map(([month, value]) => ({ month, value }))
}

export default function MonthlyTrendChart() {
  const t = useT()
  const mode = useStore((s) => s.mode)
  const maxLevel = useStore((s) => s.maxLevel)
  const [domainFilter, setDomainFilter] = useState<string[]>([])
  const [trend, setTrend] = useState<{ domains: DomainTrendSummary[]; dates: string[] } | null>(null)
  const [summary, setSummary] = useState<{ latest: OrgSnapshot; trend: OrgSnapshot[] } | null>(null)

  useEffect(() => {
    api.domainsTrendSummary('year').then(setTrend)
    api.maturitySummary().then(setSummary)
  }, [])

  const c = chrome[mode]
  const subjectsBarColor = `${categorical[mode][2]}40`

  const { rows, domainNames } = useMemo(() => {
    if (!trend || !summary) return { rows: [] as Record<string, number | string>[], domainNames: [] as string[] }

    const domains = domainFilter.length ? trend.domains.filter((d) => domainFilter.includes(d.domain)) : trend.domains
    const totalMonthly = bucketByMonth(
      summary.trend.map((s) => s.snapshot_date),
      summary.trend.map((s) => s.subject_count),
    )
    const maturityMonthly = bucketByMonth(
      summary.trend.map((s) => s.snapshot_date),
      summary.trend.map((s) => s.avg_maturity_level),
    )
    const perDomainMonthly = domains.map((d) => ({
      domain: d.domain,
      points: bucketByMonth(trend.dates, d.subject_count_series),
    }))

    const months = totalMonthly.map((m) => m.month)
    const built = months.map((month, i) => {
      const row: Record<string, number | string> = {
        month,
        total: totalMonthly[i]?.value ?? 0,
        maturity: maturityMonthly[i]?.value ?? 0,
      }
      for (const d of perDomainMonthly) {
        row[d.domain] = d.points[i]?.value ?? 0
      }
      return row
    })

    return { rows: built, domainNames: domains.map((d) => d.domain) }
  }, [trend, summary, domainFilter])

  const formatRangeMonth = (m: string) => `${m.slice(0, 4)}/${m.slice(4, 6)}`
  const dateRangeLabel = rows.length
    ? `${formatRangeMonth(String(rows[0].month))} - ${formatRangeMonth(String(rows[rows.length - 1].month))}`
    : '—'

  const options: AgCartesianChartOptions = useMemo(
    () => ({
      data: rows,
      background: { fill: 'transparent' },
      series: [
        {
          type: 'bar',
          xKey: 'month',
          yKey: 'total',
          yName: t('reports.monthly.legendSubjects'),
          fill: subjectsBarColor,
          showInLegend: false,
        },
        ...domainNames.map((domain) => ({
          type: 'line' as const,
          xKey: 'month',
          yKey: domain,
          yName: domain,
          stroke: domainColor(domain, mode),
          strokeWidth: 2,
          marker: { enabled: true, size: 4 },
        })),
        {
          type: 'line',
          xKey: 'month',
          yKey: 'maturity',
          yKeyAxis: 'y2',
          yName: t('reports.monthly.legendMaturity'),
          stroke: status.critical,
          strokeWidth: 2,
          lineDash: [4, 3],
          marker: { enabled: true, size: 4, fill: status.critical },
          showInLegend: false,
        },
      ],
      axes: {
        x: { type: 'category', position: 'bottom', label: { color: c.textSecondary, fontFamily: FONT_FAMILY } },
        y: {
          type: 'number',
          position: 'left',
          min: 0,
          title: { text: t('reports.monthly.axisSubjects'), color: c.textSecondary },
          label: { color: c.textSecondary, fontFamily: FONT_FAMILY },
          gridLine: { style: [{ stroke: c.gridline, lineDash: [3, 3] }] },
        },
        y2: {
          type: 'number',
          position: 'right',
          min: 0,
          max: maxLevel,
          title: { text: t('reports.monthly.axisMaturity'), color: c.textSecondary },
          label: { color: c.textSecondary, fontFamily: FONT_FAMILY },
          gridLine: { enabled: false },
        },
      },
      legend: {
        position: 'bottom',
        item: { label: { color: c.textSecondary, fontFamily: FONT_FAMILY, fontSize: 12 } },
      },
    }),
    [rows, domainNames, c, mode, maxLevel, t, subjectsBarColor],
  )

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom sx={{ mb: 1.5 }}>
          {t('reports.monthly.chartTitle')}
        </Typography>

        <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center', flexWrap: 'wrap', rowGap: 1.5 }}>
          <TextField
            size="small"
            select
            label={t('reports.domainFilterLabel')}
            value={domainFilter}
            onChange={(e) => {
              const value = e.target.value as unknown as string[]
              setDomainFilter(typeof value === 'string' ? (value as string).split(',') : value)
            }}
            slotProps={{
              select: {
                multiple: true,
                displayEmpty: true,
                renderValue: (selected) => ((selected as string[]).length ? (selected as string[]).join(', ') : t('reports.domainFilterAll')),
              },
            }}
            sx={{ width: 220 }}
          >
            {DOMAIN_ORDER.map((d) => (
              <MenuItem key={d} value={d}>
                <Checkbox size="small" checked={domainFilter.includes(d)} sx={{ p: 0, mr: 1 }} />
                <ListItemText primary={d} />
              </MenuItem>
            ))}
          </TextField>

          <TextField
            size="small"
            label={t('reports.monthly.dataRangeLabel')}
            value={dateRangeLabel}
            slotProps={{
              input: { readOnly: true, endAdornment: <CalendarTodayIcon sx={{ fontSize: 16, color: 'text.secondary' }} /> },
            }}
            sx={{ width: 200 }}
          />

          <Box sx={{ flex: 1 }} />

          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: subjectsBarColor }} />
            <Typography variant="caption" color="text.secondary">
              {t('reports.monthly.legendSubjects')}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 12,
                height: 0,
                borderTop: `2px dashed ${status.critical}`,
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {t('reports.monthly.legendMaturity')}
            </Typography>
          </Stack>
        </Stack>

        <Box sx={{ height: 420 }}>
          <AgCharts options={options} style={{ height: '100%', width: '100%' }} />
        </Box>
      </CardContent>
    </Card>
  )
}
