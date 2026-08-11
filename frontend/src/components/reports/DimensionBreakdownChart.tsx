import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, Typography, Box } from '@mui/material'
import { AgCharts } from 'ag-charts-react'
import type { AgCartesianChartOptions } from 'ag-charts-community'
import { api, type DomainDimensionBreakdown, type OrgSnapshot } from '../../api/client'
import { useStore } from '../../state/store'
import { chrome, categorical } from '../../theme/palette'
import { FONT_FAMILY } from '../../theme/echartsTheme'
import { useT } from '../../i18n/useT'

export default function DimensionBreakdownChart({ domainFilter }: { domainFilter: string | null }) {
  const t = useT()
  const mode = useStore((s) => s.mode)
  const dimensions = useStore((s) => s.dimensions)
  const [breakdown, setBreakdown] = useState<DomainDimensionBreakdown[] | null>(null)
  const [domains, setDomains] = useState<OrgSnapshot[] | null>(null)

  useEffect(() => {
    api.domainsDimensionBreakdown().then((res) => setBreakdown(res.domains))
    api.domainRanking().then((res) => setDomains(res.domains))
  }, [])

  const c = chrome[mode]
  const palette = categorical[mode]

  const rows = useMemo(() => {
    const maturityByDomain = new Map((domains ?? []).map((d) => [d.domain, d.avg_maturity_level]))
    const all = breakdown ?? []
    const filtered = domainFilter ? all.filter((d) => d.domain === domainFilter) : all
    return filtered.map((d) => ({
      ...d,
      maturity: maturityByDomain.get(d.domain) ?? 0,
    }))
  }, [breakdown, domains, domainFilter])

  const options: AgCartesianChartOptions = useMemo(
    () => ({
      data: rows,
      background: { fill: 'transparent' },
      series: [
        ...dimensions.map((dim, i) => ({
          type: 'bar' as const,
          xKey: 'domain',
          yKey: dim.key,
          yName: dim.label,
          stackGroup: 'dims',
          fill: palette[i % palette.length],
        })),
        {
          type: 'line' as const,
          xKey: 'domain',
          yKey: 'maturity',
          yName: t('reports.dimChart.maturityLine'),
          stroke: c.textPrimary,
          marker: { enabled: true, fill: c.textPrimary, stroke: c.surface },
        },
      ],
      axes: {
        x: { type: 'category', position: 'bottom', label: { color: c.textSecondary, fontFamily: FONT_FAMILY } },
        y: {
          type: 'number',
          position: 'left',
          min: 0,
          label: { color: c.textSecondary, fontFamily: FONT_FAMILY },
          gridLine: { style: [{ stroke: c.gridline, lineDash: [3, 3] }] },
        },
      },
      legend: {
        position: 'bottom',
        item: { label: { color: c.textSecondary, fontFamily: FONT_FAMILY, fontSize: 12 } },
      },
    }),
    [rows, dimensions, palette, c, t],
  )

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom sx={{ mb: 1 }}>
          {t('reports.dimChart.title')}
        </Typography>
        <Box sx={{ height: 360 }}>
          <AgCharts options={options} style={{ height: '100%', width: '100%' }} />
        </Box>
      </CardContent>
    </Card>
  )
}
