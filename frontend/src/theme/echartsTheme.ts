import { chrome, type Mode } from './palette'

// Shared ECharts option fragments so every chart in the dashboard reads as
// one system: hairline hairline gridlines, recessive axes, consistent
// tooltip chrome. Per-chart components spread these into their own `option`.
export function baseAxis(mode: Mode) {
  const c = chrome[mode]
  return {
    axisLine: { lineStyle: { color: c.baseline } },
    axisTick: { show: false },
    axisLabel: { color: c.textMuted, fontSize: 12 },
    splitLine: { lineStyle: { color: c.gridline, type: 'solid' as const } },
  }
}

export function tooltipStyle(mode: Mode) {
  const c = chrome[mode]
  return {
    backgroundColor: c.surface,
    borderColor: c.gridline,
    borderWidth: 1,
    textStyle: { color: c.textPrimary, fontSize: 12 },
    extraCssText: `box-shadow: 0 2px 12px ${mode === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.12)'}; border-radius: 8px;`,
  }
}

export const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", sans-serif'
