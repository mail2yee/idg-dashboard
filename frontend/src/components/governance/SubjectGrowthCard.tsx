import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, Typography, Box, Stack, Chip } from '@mui/material'
import ReactECharts from 'echarts-for-react'
import { api, type SubjectGrowthResponse } from '../../api/client'
import { useStore } from '../../state/store'
import { chrome, categorical, status } from '../../theme/palette'
import InfoTooltip from '../InfoTooltip'
import { useT } from '../../i18n/useT'

export default function SubjectGrowthCard() {
  const t = useT()
  const mode = useStore((s) => s.mode)
  const setSelectedSubjectId = useStore((s) => s.setSelectedSubjectId)
  const [data, setData] = useState<SubjectGrowthResponse | null>(null)

  useEffect(() => {
    api.governanceSubjectGrowth().then(setData)
  }, [])

  const c = chrome[mode]
  const accent = categorical[mode][0]

  const trendOption = useMemo(() => {
    const trend = data?.total_trend ?? []
    return {
      animation: false,
      grid: { left: 0, right: 0, top: 6, bottom: 0 },
      xAxis: { type: 'category', show: false, data: trend.map((_, i) => i) },
      yAxis: { type: 'value', show: false, min: (v: { min: number }) => Math.max(0, v.min - 2) },
      tooltip: { show: false },
      series: [
        {
          type: 'line',
          data: trend,
          showSymbol: false,
          lineStyle: { width: 2, color: c.textMuted },
        },
        {
          type: 'line',
          data: trend.map((v, i) => (i === trend.length - 1 ? v : null)),
          showSymbol: true,
          symbolSize: 8,
          lineStyle: { width: 0 },
          itemStyle: { color: accent, borderColor: c.surface, borderWidth: 2 },
        },
      ],
    }
  }, [data, c, accent])

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={0} sx={{ alignItems: 'center' }}>
          <Typography variant="subtitle1" gutterBottom sx={{ mb: 0 }}>
            {t('gov.growth.title')}
          </Typography>
          <InfoTooltip text={t('gov.growth.tooltip')} />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
          {t('gov.growth.thresholdLine', { days: data?.window_days ?? 7, threshold: data?.flag_threshold ?? 3 })}
        </Typography>

        <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'flex-end' }}>
          <Box>
            <Typography sx={{ fontSize: 36, fontWeight: 600, lineHeight: 1 }}>{data?.total_subjects ?? '—'}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t('gov.growth.totalDetail', { days: data?.window_days ?? 7, n: data?.new_subjects_total ?? 0 })}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, height: 40 }}>
            <ReactECharts option={trendOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
          </Box>
        </Stack>

        <Stack spacing={0.8}>
          {data?.domains.map((d) => (
            <Box
              key={d.domain}
              sx={{
                p: d.flagged ? 1 : 0,
                borderRadius: 1,
                bgcolor: d.flagged ? `${status.warning}1a` : 'transparent',
              }}
            >
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: d.flagged ? 600 : 400, color: d.flagged ? status.warning : 'text.primary' }}>
                  {d.domain}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('gov.growth.domainDetail', { current: d.current_count, days: data.window_days, n: d.new_count })}
                </Typography>
              </Stack>
              {d.flagged && d.new_subjects.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mt: 0.8 }}>
                  {d.new_subjects.map((s) => (
                    <Chip
                      key={s.id}
                      size="small"
                      label={s.name}
                      onClick={() => setSelectedSubjectId(s.id)}
                      sx={{ cursor: 'pointer' }}
                    />
                  ))}
                </Stack>
              )}
            </Box>
          ))}
        </Stack>

        {data && data.flagged_domains.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {t('gov.growth.noneFlagged')}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}
