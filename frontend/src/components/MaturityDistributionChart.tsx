import { Card, CardContent, Typography, Box } from '@mui/material'
import ReactECharts from 'echarts-for-react'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useStore } from '../state/store'
import { chrome, categorical } from '../theme/palette'
import { baseAxis, tooltipStyle, FONT_FAMILY } from '../theme/echartsTheme'

// bucket ranges come straight from the "N-N+1" label the backend computes
// off config/maturity_dimensions.json's total weight — no fixed 5-bucket
// assumption here, so an added dimension just grows the bucket count.
function rangeToMinMax(range: string): [number, number] {
  const [min, max] = range.split('-').map(Number)
  return [min, max]
}

export default function MaturityDistributionChart() {
  const mode = useStore((s) => s.mode)
  const scoreRange = useStore((s) => s.scoreRange)
  const setScoreRange = useStore((s) => s.setScoreRange)
  const [buckets, setBuckets] = useState<{ range: string; count: number }[]>([])

  useEffect(() => {
    api.maturityDistribution().then((res) => setBuckets(res.buckets))
  }, [])

  const c = chrome[mode]
  const accent = categorical[mode][0]

  const option = {
    animation: false,
    grid: { left: 36, right: 16, top: 16, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'none' },
      ...tooltipStyle(mode),
      formatter: (params: { name: string; value: number }[]) => `${params[0].name} 分: ${params[0].value} 個 subjects`,
    },
    xAxis: {
      type: 'category',
      data: buckets.map((b) => b.range),
      ...baseAxis(mode),
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      ...baseAxis(mode),
    },
    series: [
      {
        type: 'bar',
        data: buckets.map((b) => {
          const range = rangeToMinMax(b.range)
          const isSelected = scoreRange && range[0] === scoreRange[0]
          return {
            value: b.count,
            itemStyle: {
              color: accent,
              opacity: scoreRange ? (isSelected ? 1 : 0.35) : 1,
              borderRadius: [4, 4, 0, 0],
            },
          }
        }),
        barMaxWidth: 40,
        label: {
          show: true,
          position: 'top',
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
        <Typography variant="subtitle2" gutterBottom>
          Maturity Score 分佈
        </Typography>
        <Box sx={{ height: 220 }}>
          <ReactECharts
            option={option}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'svg' }}
            onEvents={{
              click: (params: { dataIndex: number }) => {
                const range = rangeToMinMax(buckets[params.dataIndex].range)
                const isSame = scoreRange && range[0] === scoreRange[0]
                setScoreRange(isSame ? null : range)
              },
            }}
          />
        </Box>
      </CardContent>
    </Card>
  )
}
