import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, Typography, Box, Stack, Chip } from '@mui/material'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import ReactECharts from 'echarts-for-react'
import { api, type StewardshipResponse } from '../../api/client'
import { useStore } from '../../state/store'
import { chrome, status } from '../../theme/palette'
import { baseAxis, tooltipStyle, FONT_FAMILY } from '../../theme/echartsTheme'
import InfoTooltip from '../InfoTooltip'

export default function StewardshipCard() {
  const mode = useStore((s) => s.mode)
  const [data, setData] = useState<StewardshipResponse | null>(null)

  useEffect(() => {
    api.governanceStewardship().then(setData)
  }, [])

  const c = chrome[mode]

  const option = useMemo(() => {
    const rows = [...(data?.teams ?? [])].sort((a, b) => a.overdue_count - b.overdue_count)
    return {
      animation: false,
      grid: { left: 130, right: 40, top: 8, bottom: 8 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'none' },
        ...tooltipStyle(mode),
        formatter: (params: { name: string }[]) => {
          const d = rows.find((x) => x.team === params[0].name)
          if (!d) return ''
          return `${d.team}<br/>逾期 7 天未解決:${d.overdue_count}<br/>目前開啟中:${d.open_count}<br/>平均解決時間:${d.avg_resolution_hours ?? '—'} 小時`
        },
      },
      xAxis: { type: 'value', min: 0, ...baseAxis(mode) },
      yAxis: {
        type: 'category',
        data: rows.map((d) => d.team),
        axisLine: { lineStyle: { color: c.baseline } },
        axisTick: { show: false },
        axisLabel: { color: c.textPrimary, fontSize: 12, fontFamily: FONT_FAMILY },
        splitLine: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: rows.map((d) => ({
            value: d.overdue_count,
            itemStyle: { color: d.overdue_count > 0 ? status.critical : c.textMuted, borderRadius: [0, 4, 4, 0] },
          })),
          barMaxWidth: 18,
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
  }, [data, mode, c])

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={0} sx={{ alignItems: 'center' }}>
          <Typography variant="subtitle1" gutterBottom sx={{ mb: 0 }}>
            Stewardship 回應力:出問題之後有沒有人管?
          </Typography>
          <InfoTooltip text="Maturity Level 的 L4 只看「有沒有裝品質檢查」,這裡看「檢查出問題之後,多久有人處理」——兩者互補,不是重複。" />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
          逾期 = incident 開啟超過 7 天還沒解決
        </Typography>

        {data?.most_responsive_team && (
          <Chip
            icon={<EmojiEventsIcon sx={{ fontSize: 16 }} />}
            label={`本週回應最快:${data.most_responsive_team}`}
            color="success"
            variant="outlined"
            size="small"
            sx={{ mb: 1.5 }}
          />
        )}

        <Box sx={{ height: 200 }}>
          <ReactECharts option={option} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
        </Box>

        <Stack spacing={0.8} sx={{ mt: 1 }}>
          {data?.teams
            .slice()
            .sort((a, b) => b.overdue_count - a.overdue_count)
            .map((t) => (
              <Stack key={t.team} direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2">{t.team}</Typography>
                <Typography variant="caption" color="text.secondary">
                  開啟中 {t.open_count} · 平均解決 {t.avg_resolution_hours ?? '—'} 小時 · 本週解決 {t.resolved_7d_count}
                </Typography>
              </Stack>
            ))}
        </Stack>
      </CardContent>
    </Card>
  )
}
