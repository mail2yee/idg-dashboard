import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, Typography, Box } from '@mui/material'
import { AgCharts } from 'ag-charts-react'
import type { AgPolarChartOptions } from 'ag-charts-community'
import { api, type OrgSnapshot } from '../../api/client'
import { useStore } from '../../state/store'
import { chrome, domainColor } from '../../theme/palette'
import { FONT_FAMILY } from '../../theme/echartsTheme'
import { useT } from '../../i18n/useT'

export default function ProductSuiteDonutChart({ domainFilter }: { domainFilter: string | null }) {
  const t = useT()
  const mode = useStore((s) => s.mode)
  const [domains, setDomains] = useState<OrgSnapshot[] | null>(null)

  useEffect(() => {
    api.domainRanking().then((res) => setDomains(res.domains))
  }, [])

  const c = chrome[mode]

  const rows = useMemo(() => {
    const all = domains ?? []
    return domainFilter ? all.filter((d) => d.domain === domainFilter) : all
  }, [domains, domainFilter])

  const options: AgPolarChartOptions = useMemo(
    () => ({
      data: rows.map((d) => ({ domain: d.domain, count: d.subject_count })),
      background: { fill: 'transparent' },
      series: [
        {
          type: 'donut',
          angleKey: 'count',
          calloutLabelKey: 'domain',
          sectorLabelKey: 'count',
          innerRadiusRatio: 0.62,
          itemStyler: (p: { datum: { domain: string } }) => ({ fill: domainColor(p.datum.domain, mode) }),
          calloutLabel: { color: c.textSecondary, fontFamily: FONT_FAMILY },
          sectorLabel: { color: '#fff', fontFamily: FONT_FAMILY, fontSize: 11 },
          strokeWidth: 2,
          stroke: c.surface,
        },
      ],
      legend: {
        position: 'bottom',
        item: { label: { color: c.textSecondary, fontFamily: FONT_FAMILY, fontSize: 12 } },
      },
    }),
    [rows, mode, c],
  )

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom sx={{ mb: 1 }}>
          {t('reports.donut.title')}
        </Typography>
        <Box sx={{ height: 320 }}>
          <AgCharts options={options} style={{ height: '100%', width: '100%' }} />
        </Box>
      </CardContent>
    </Card>
  )
}
