import { useMemo } from 'react'
import { Box } from '@mui/material'
import { AgCharts } from 'ag-charts-react'
import type { AgCartesianChartOptions } from 'ag-charts-community'
import { useStore } from '../../state/store'
import { chrome } from '../../theme/palette'

export default function SparklineChart({ values }: { values: number[] }) {
  const mode = useStore((s) => s.mode)
  const c = chrome[mode]

  const options: AgCartesianChartOptions = useMemo(
    () => ({
      data: values.map((v, i) => ({ i, v })),
      background: { fill: 'transparent' },
      padding: { top: 4, right: 4, bottom: 4, left: 4 },
      series: [
        {
          type: 'line',
          xKey: 'i',
          yKey: 'v',
          stroke: c.textMuted,
          strokeWidth: 1.5,
          marker: { enabled: false },
        },
      ],
      axes: {
        x: { type: 'category', label: { enabled: false }, line: { enabled: false }, gridLine: { enabled: false }, tick: { enabled: false } },
        y: { type: 'number', label: { enabled: false }, line: { enabled: false }, gridLine: { enabled: false }, tick: { enabled: false } },
      },
      legend: { enabled: false },
      tooltip: { enabled: false },
    }),
    [values, c],
  )

  return (
    <Box sx={{ height: 36, width: '100%' }}>
      <AgCharts options={options} style={{ height: '100%', width: '100%' }} />
    </Box>
  )
}
