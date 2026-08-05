import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, Typography, Box, Stack, Chip } from '@mui/material'
import ReactECharts from 'echarts-for-react'
import { api, type OwnershipCoverageResponse } from '../../api/client'
import { useStore } from '../../state/store'
import { chrome, domainColor } from '../../theme/palette'
import { baseAxis, tooltipStyle, FONT_FAMILY } from '../../theme/echartsTheme'
import InfoTooltip from '../InfoTooltip'
import { useT } from '../../i18n/useT'

const ROLE_LABELS: Record<string, string> = {
  DATA_OWNER: 'Data Owner',
  DATA_STEWARD: 'Data Steward',
  IT_OWNER: 'IT Owner',
}
const ROLE_ORDER = ['DATA_OWNER', 'DATA_STEWARD', 'IT_OWNER']

export default function OwnershipCoverageCard() {
  const t = useT()
  const mode = useStore((s) => s.mode)
  const setSelectedSubjectId = useStore((s) => s.setSelectedSubjectId)
  const [data, setData] = useState<OwnershipCoverageResponse | null>(null)

  useEffect(() => {
    api.governanceOwnershipCoverage().then(setData)
  }, [])

  const c = chrome[mode]

  const option = useMemo(() => {
    const rows = [...(data?.by_domain ?? [])].sort((a, b) => a.coverage_pct - b.coverage_pct)
    return {
      animation: false,
      grid: { left: 90, right: 40, top: 8, bottom: 8 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'none' },
        ...tooltipStyle(mode),
        formatter: (params: { name: string }[]) => {
          const d = rows.find((x) => x.domain === params[0].name)
          return d
            ? t('gov.ownership.chartTooltip', { domain: d.domain, covered: d.fully_covered, total: d.total, pct: d.coverage_pct })
            : ''
        },
      },
      xAxis: { type: 'value', min: 0, max: 100, ...baseAxis(mode) },
      yAxis: {
        type: 'category',
        data: rows.map((d) => d.domain),
        axisLine: { lineStyle: { color: c.baseline } },
        axisTick: { show: false },
        axisLabel: { color: c.textPrimary, fontSize: 13, fontFamily: FONT_FAMILY },
        splitLine: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: rows.map((d) => ({
            value: d.coverage_pct,
            itemStyle: { color: domainColor(d.domain, mode), borderRadius: [0, 4, 4, 0] },
          })),
          barMaxWidth: 20,
          label: {
            show: true,
            position: 'right',
            formatter: '{c}%',
            color: c.textSecondary,
            fontSize: 12,
            fontFamily: FONT_FAMILY,
          },
        },
      ],
    }
  }, [data, mode, c, t])

  const gapEntries = useMemo(() => {
    if (!data) return []
    const seen = new Set<string>()
    const merged: { id: string; name: string; domain: string; missingRoles: string[] }[] = []
    for (const role of ROLE_ORDER) {
      for (const g of data.gaps[role] ?? []) {
        if (seen.has(g.id)) {
          merged.find((m) => m.id === g.id)?.missingRoles.push(role)
        } else {
          seen.add(g.id)
          merged.push({ ...g, missingRoles: [role] })
        }
      }
    }
    return merged.slice(0, 10)
  }, [data])

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={0} sx={{ alignItems: 'center' }}>
          <Typography variant="subtitle1" gutterBottom sx={{ mb: 0 }}>
            {t('gov.ownership.title')}
          </Typography>
          <InfoTooltip text={t('gov.ownership.tooltip')} />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
          {t('gov.ownership.subtitle')}
        </Typography>

        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 36, fontWeight: 600, lineHeight: 1 }}>
              {data ? `${data.coverage_pct}%` : '—'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {data ? t('gov.ownership.coverageDetail', { covered: data.fully_covered, total: data.total_subjects }) : ''}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, alignItems: 'flex-start' }}>
            {ROLE_ORDER.map((role) => (
              <Chip
                key={role}
                size="small"
                variant="outlined"
                label={t('gov.ownership.roleChip', {
                  role: ROLE_LABELS[role],
                  pct: data?.role_coverage[role]?.covered_pct ?? '—',
                  missing: data?.role_coverage[role]?.missing_count ?? 0,
                })}
              />
            ))}
          </Stack>
        </Stack>

        <Box sx={{ height: 180 }}>
          <ReactECharts option={option} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
        </Box>

        {gapEntries.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {t('gov.ownership.pendingTitle', { n: gapEntries.length, plus: gapEntries.length >= 10 ? '+' : '' })}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {gapEntries.map((g) => (
                <Chip
                  key={g.id}
                  size="small"
                  label={`${g.name} · ${t('gov.ownership.missingPrefix')}${g.missingRoles.map((r) => ROLE_LABELS[r]).join('/')}`}
                  onClick={() => setSelectedSubjectId(g.id)}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
