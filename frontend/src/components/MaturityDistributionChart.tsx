import { Card, CardContent, Typography, Box, Stack } from '@mui/material'
import ReactECharts from 'echarts-for-react'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useStore } from '../state/store'
import { chrome } from '../theme/palette'
import { getLevelColor } from '../theme/badges'
import { baseAxis, tooltipStyle, FONT_FAMILY } from '../theme/echartsTheme'
import InfoTooltip from './InfoTooltip'

export default function MaturityDistributionChart() {
  const mode = useStore((s) => s.mode)
  const levelRange = useStore((s) => s.levelRange)
  const setLevelRange = useStore((s) => s.setLevelRange)
  const [levels, setLevels] = useState<{ level: number; count: number }[]>([])

  useEffect(() => {
    api.maturityDistribution().then((res) => setLevels(res.levels))
  }, [])

  const c = chrome[mode]

  const option = {
    animation: false,
    grid: { left: 36, right: 16, top: 16, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'none' },
      ...tooltipStyle(mode),
      formatter: (params: { name: string; value: number }[]) => `${params[0].name}: ${params[0].value} 個 subjects`,
    },
    xAxis: {
      type: 'category',
      data: levels.map((l) => `L${l.level}`),
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
        data: levels.map((l) => {
          const isSelected = levelRange && l.level === levelRange[0]
          return {
            value: l.count,
            itemStyle: {
              color: getLevelColor(l.level),
              opacity: levelRange ? (isSelected ? 1 : 0.35) : 1,
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
        <Stack direction="row" spacing={0} sx={{ alignItems: 'center' }}>
          <Typography variant="subtitle2" gutterBottom sx={{ mb: 0 }}>
            Maturity Level 分佈
          </Typography>
          <InfoTooltip text="每個 data subject 依目前的 Maturity Level(L1-L5)分到對應的長條——柱子越高代表卡在那個等級的資料集越多。點一根柱子可以篩選下面的清單只看那個等級。" />
        </Stack>
        <Box sx={{ height: 220 }}>
          <ReactECharts
            option={option}
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'svg' }}
            onEvents={{
              click: (params: { dataIndex: number }) => {
                const level = levels[params.dataIndex].level
                const isSame = levelRange && level === levelRange[0]
                setLevelRange(isSame ? null : [level, level])
              },
            }}
          />
        </Box>
      </CardContent>
    </Card>
  )
}
