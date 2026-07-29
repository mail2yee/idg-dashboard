import { Card, CardContent, Stack, Typography, Box } from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ReactECharts from 'echarts-for-react'
import { useEffect, useState } from 'react'
import { api, type OrgSnapshot } from '../api/client'
import { useStore } from '../state/store'
import { chrome, categorical } from '../theme/palette'

export default function HeadlineIndexCard() {
  const mode = useStore((s) => s.mode)
  const maxScore = useStore((s) => s.maxScore)
  const [latest, setLatest] = useState<OrgSnapshot | null>(null)
  const [trend, setTrend] = useState<OrgSnapshot[]>([])

  useEffect(() => {
    api.maturitySummary().then((res) => {
      setLatest(res.latest)
      setTrend(res.trend)
    })
  }, [])

  const c = chrome[mode]
  const accent = categorical[mode][0]
  const isUp = (latest?.wow_delta ?? 0) >= 0

  const sparklineOption = {
    animation: false,
    grid: { left: 0, right: 0, top: 6, bottom: 0 },
    xAxis: { type: 'category', show: false, data: trend.map((t) => t.snapshot_date) },
    yAxis: { type: 'value', show: false, min: (v: { min: number }) => v.min - 2 },
    tooltip: { show: false },
    series: [
      {
        type: 'line',
        data: trend.map((t) => t.data_quality_index),
        showSymbol: false,
        lineStyle: { width: 2, color: c.textMuted },
        areaStyle: undefined,
        markPoint: undefined,
        emphasis: { disabled: true },
      },
      {
        type: 'line',
        data: trend.map((t, i) => (i === trend.length - 1 ? t.data_quality_index : null)),
        showSymbol: true,
        symbolSize: 8,
        lineStyle: { width: 0 },
        itemStyle: { color: accent, borderColor: c.surface, borderWidth: 2 },
      },
    ],
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Data Quality Index
        </Typography>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'baseline' }}>
          <Typography sx={{ fontSize: 48, fontWeight: 600, lineHeight: 1 }}>
            {latest ? latest.data_quality_index.toFixed(1) : '—'}
          </Typography>
          {latest && (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              {isUp ? (
                <ArrowUpwardIcon sx={{ fontSize: 16, color: c.successText }} />
              ) : (
                <ArrowDownwardIcon sx={{ fontSize: 16, color: '#d03b3b' }} />
              )}
              <Typography variant="body2" sx={{ color: isUp ? c.successText : '#d03b3b' }}>
                {Math.abs(latest.wow_delta).toFixed(2)} vs last week
              </Typography>
            </Stack>
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {latest ? `平均 maturity ${latest.avg_maturity_score.toFixed(2)} / ${maxScore} · ${latest.subject_count} data subjects` : ''}
        </Typography>
        <Box sx={{ height: 48, mt: 1 }}>
          <ReactECharts option={sparklineOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
        </Box>
      </CardContent>
    </Card>
  )
}
