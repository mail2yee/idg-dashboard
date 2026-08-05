import { Card, CardContent, Typography, Box, Stack } from '@mui/material'
import ReactECharts from 'echarts-for-react'
import { useEffect, useState } from 'react'
import { api, type OrgSnapshot } from '../api/client'
import { useStore } from '../state/store'
import { chrome, domainColor } from '../theme/palette'
import { baseAxis, tooltipStyle, FONT_FAMILY } from '../theme/echartsTheme'
import InfoTooltip from './InfoTooltip'
import { useT } from '../i18n/useT'

export default function DomainRankingChart() {
  const mode = useStore((s) => s.mode)
  const t = useT()
  const maxLevel = useStore((s) => s.maxLevel)
  const selectedDomain = useStore((s) => s.selectedDomain)
  const setSelectedDomain = useStore((s) => s.setSelectedDomain)
  const highlightedDomains = useStore((s) => s.highlightedDomains)
  const [domains, setDomains] = useState<OrgSnapshot[]>([])

  useEffect(() => {
    api.domainRanking().then((res) => setDomains(res.domains))
  }, [])

  const c = chrome[mode]
  // ascending for horizontal bar so the highest score renders at the top
  const sorted = [...domains].sort((a, b) => a.avg_maturity_level - b.avg_maturity_level)
  const hasFocus = Boolean(selectedDomain) || highlightedDomains.length > 0

  const option = {
    animation: false,
    grid: { left: 90, right: 40, top: 8, bottom: 8 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'none' },
      ...tooltipStyle(mode),
      formatter: (params: { name: string; value: number }[]) => {
        const d = sorted.find((x) => x.domain === params[0].name)
        return `${params[0].name}: ${params[0].value} / L${maxLevel}<br/>WoW ${d ? (d.wow_delta >= 0 ? '+' : '') + d.wow_delta.toFixed(2) : ''}`
      },
    },
    xAxis: { type: 'value', min: 0, max: maxLevel, ...baseAxis(mode) },
    yAxis: {
      type: 'category',
      data: sorted.map((d) => d.domain),
      axisLine: { lineStyle: { color: c.baseline } },
      axisTick: { show: false },
      axisLabel: { color: c.textPrimary, fontSize: 13, fontFamily: FONT_FAMILY },
      splitLine: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: sorted.map((d) => {
          const isFocused = highlightedDomains.includes(d.domain!) || selectedDomain === d.domain
          return {
            value: d.avg_maturity_level,
            itemStyle: {
              color: domainColor(d.domain!, mode),
              opacity: hasFocus ? (isFocused ? 1 : 0.3) : 1,
              borderRadius: [0, 4, 4, 0],
            },
          }
        }),
        barMaxWidth: 22,
        label: {
          show: true,
          position: 'right',
          color: c.textSecondary,
          fontSize: 12,
          fontFamily: FONT_FAMILY,
        },
      },
    ],
  }

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={0} sx={{ alignItems: 'center' }}>
          <Typography variant="subtitle2" gutterBottom sx={{ mb: 0 }}>
            {t('overview.domainRanking.title')}
          </Typography>
          <InfoTooltip text={t('overview.domainRanking.tooltip')} />
        </Stack>
        <Box sx={{ height: 260 }}>
          <ReactECharts
            option={option}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'svg' }}
            onEvents={{
              click: (params: { name: string }) => setSelectedDomain(params.name),
            }}
          />
        </Box>
      </CardContent>
    </Card>
  )
}
