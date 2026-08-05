import { Card, CardContent, Stack, Typography, Box } from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ReactECharts from 'echarts-for-react'
import { useEffect, useState } from 'react'
import { api, type OrgSnapshot } from '../api/client'
import { useStore } from '../state/store'
import { chrome, categorical } from '../theme/palette'
import InfoTooltip from './InfoTooltip'
import { useT } from '../i18n/useT'

export default function HeadlineIndexCard() {
  const mode = useStore((s) => s.mode)
  const maxLevel = useStore((s) => s.maxLevel)
  const t = useT()
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
  // wow_delta is a Level delta (e.g. 0.02 out of maxLevel) -- convert to the
  // same 0-100 scale as data_quality_index so the two numbers next to each
  // other share a unit, instead of showing a Level delta beside a % score.
  const deltaPts = ((latest?.wow_delta ?? 0) / maxLevel) * 100

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
        <Stack direction="row" spacing={0} sx={{ alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 0 }}>
            {t('overview.dqi.title')}
          </Typography>
          <InfoTooltip text={t('overview.dqi.tooltip')} />
        </Stack>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'baseline' }}>
          <Typography sx={{ fontSize: 48, fontWeight: 600, lineHeight: 1 }}>
            {latest ? `${latest.data_quality_index.toFixed(1)}%` : '—'}
          </Typography>
          {latest && (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              {isUp ? (
                <ArrowUpwardIcon sx={{ fontSize: 16, color: c.successText }} />
              ) : (
                <ArrowDownwardIcon sx={{ fontSize: 16, color: '#d03b3b' }} />
              )}
              <Typography variant="body2" sx={{ color: isUp ? c.successText : '#d03b3b' }}>
                {Math.abs(deltaPts).toFixed(1)} pts vs last week
              </Typography>
            </Stack>
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {latest
            ? `${t('overview.dqi.avgScore')} ${latest.avg_maturity_level.toFixed(1)} / L${maxLevel} · ${latest.subject_count} data subjects`
            : ''}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
          {t('overview.dqi.formula')} L{maxLevel} × 100
        </Typography>
        <Box sx={{ height: 48, mt: 1 }}>
          <ReactECharts option={sparklineOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
        </Box>
      </CardContent>
    </Card>
  )
}
