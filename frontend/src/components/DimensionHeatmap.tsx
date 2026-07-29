import ReactECharts from 'echarts-for-react'
import { chrome, sequentialBlue, type Mode } from '../theme/palette'
import { FONT_FAMILY } from '../theme/echartsTheme'
import type { DimensionMeta } from '../api/client'

export interface HeatmapRow {
  label: string
  values: Record<string, number>
}

interface EChartsHeatmapClick {
  componentType: string
  value: [number, number, number]
}

export default function DimensionHeatmap({
  rows,
  dims,
  mode,
  onRowClick,
  height,
}: {
  rows: HeatmapRow[]
  dims: DimensionMeta[]
  mode: Mode
  onRowClick?: (label: string) => void
  height?: number
}) {
  const c = chrome[mode]
  const yLabels = rows.map((r) => r.label)

  const data = rows.flatMap((r, yi) =>
    dims.map((d, xi) => {
      const v = r.values[d.key] ?? 0
      return {
        value: [xi, yi, v] as [number, number, number],
        label: { color: v > 0.55 ? '#ffffff' : c.textPrimary },
      }
    }),
  )

  const option = {
    animation: false,
    grid: { left: 160, right: 24, top: 10, bottom: dims.length > 5 ? 95 : 70 },
    tooltip: {
      position: 'top',
      backgroundColor: c.surface,
      borderColor: c.gridline,
      borderWidth: 1,
      textStyle: { color: c.textPrimary, fontSize: 12 },
      formatter: (p: { value: [number, number, number] }) => {
        const d = dims[p.value[0]]
        const role = d?.responsible_role ? ` · ${d.responsible_role}` : ''
        return `${yLabels[p.value[1]]}<br/>${d?.label}${role}: ${p.value[2].toFixed(2)}`
      },
    },
    xAxis: {
      type: 'category',
      data: dims.map((d) => d.label),
      splitArea: { show: true },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: c.textSecondary,
        fontSize: 12,
        fontFamily: FONT_FAMILY,
        interval: 0,
        rotate: dims.length > 5 ? 20 : 0,
      },
    },
    yAxis: {
      type: 'category',
      data: yLabels,
      splitArea: { show: true },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: c.textPrimary, fontSize: 12, fontFamily: FONT_FAMILY },
    },
    visualMap: {
      min: 0,
      max: 1,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      itemWidth: 12,
      itemHeight: 120,
      textStyle: { color: c.textSecondary, fontSize: 11, fontFamily: FONT_FAMILY },
      inRange: { color: sequentialBlue[mode] },
    },
    series: [
      {
        type: 'heatmap',
        data,
        label: {
          show: true,
          formatter: (p: { value: [number, number, number] }) => p.value[2].toFixed(2),
          fontSize: 11,
          fontFamily: FONT_FAMILY,
        },
        itemStyle: { borderColor: c.surface, borderWidth: 2 },
        emphasis: { itemStyle: { borderColor: c.baseline, borderWidth: 1 } },
      },
    ],
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: height ?? Math.max(240, rows.length * 32 + 110), width: '100%' }}
      opts={{ renderer: 'svg' }}
      onEvents={
        onRowClick
          ? {
              click: (params: EChartsHeatmapClick) => {
                if (params.componentType === 'series') onRowClick(yLabels[params.value[1]])
              },
            }
          : undefined
      }
    />
  )
}
