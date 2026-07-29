import ReactECharts from 'echarts-for-react'
import { chrome, categorical, type Mode } from '../theme/palette'

interface SparklineProps {
  data: number[]
  mode: Mode
  max?: number
  height?: number | string
  width?: number | string
}

// Stat-tile sparkline spec: de-emphasis hue for the line, current period
// picked out in the accent color. Shared by the headline card and the
// Trends tables so every "score over time" glance reads the same way.
export default function Sparkline({ data, mode, max = 5, height = 32, width = 100 }: SparklineProps) {
  const c = chrome[mode]
  const accent = categorical[mode][0]

  const option = {
    animation: false,
    grid: { left: 0, right: 0, top: 4, bottom: 0 },
    xAxis: { type: 'category', show: false, data: data.map((_, i) => i) },
    yAxis: { type: 'value', show: false, min: 0, max },
    tooltip: { show: false },
    series: [
      {
        type: 'line',
        data,
        showSymbol: false,
        lineStyle: { width: 2, color: c.textMuted },
      },
      {
        type: 'line',
        data: data.map((v, i) => (i === data.length - 1 ? v : null)),
        showSymbol: true,
        symbolSize: 6,
        lineStyle: { width: 0 },
        itemStyle: { color: accent, borderColor: c.surface, borderWidth: 2 },
      },
    ],
  }

  return <ReactECharts option={option} style={{ height, width }} opts={{ renderer: 'svg' }} />
}
