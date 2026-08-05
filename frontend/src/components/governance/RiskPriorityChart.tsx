import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, Typography, Box, Stack, Chip } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import ReactECharts from 'echarts-for-react'
import { api, type RiskPriorityResponse, type RiskPriorityRow } from '../../api/client'
import { useStore } from '../../state/store'
import { chrome, domainColor, DOMAIN_ORDER } from '../../theme/palette'
import { baseAxis, tooltipStyle, FONT_FAMILY } from '../../theme/echartsTheme'
import InfoTooltip from '../InfoTooltip'
import { useT } from '../../i18n/useT'

export default function RiskPriorityChart() {
  const t = useT()
  const mode = useStore((s) => s.mode)
  const setSelectedSubjectId = useStore((s) => s.setSelectedSubjectId)
  const [data, setData] = useState<RiskPriorityResponse | null>(null)

  useEffect(() => {
    api.governanceRiskPriority(15).then(setData)
  }, [])

  const c = chrome[mode]

  const maxRisk = useMemo(
    () => Math.max(1, ...(data?.scatter.map((r) => r.risk_score ?? 0) ?? [1])),
    [data],
  )

  const option = useMemo(() => {
    const rows = data?.scatter ?? []
    const domainsPresent = DOMAIN_ORDER.filter((d) => rows.some((r) => r.domain === d))
    const series = domainsPresent.map((domain) => ({
      name: domain,
      type: 'scatter' as const,
      data: rows
        .filter((r) => r.domain === domain)
        .map((r) => ({
          value: [r.usage_30d ?? 0, r.maturity_level],
          name: r.name,
          risk_score: r.risk_score ?? 0,
        })),
      symbolSize: (_val: number[], params: { data: { risk_score: number } }) =>
        8 + (params.data.risk_score / maxRisk) * 26,
      itemStyle: { color: domainColor(domain, mode), opacity: 0.75 },
      emphasis: { itemStyle: { opacity: 1, borderColor: c.surface, borderWidth: 1 } },
    }))

    return {
      animation: false,
      grid: { left: 56, right: 24, top: 44, bottom: 56 },
      legend: {
        top: 0,
        left: 0,
        itemHeight: 10,
        textStyle: { color: c.textSecondary, fontSize: 12, fontFamily: FONT_FAMILY },
        icon: 'circle',
      },
      tooltip: {
        trigger: 'item',
        ...tooltipStyle(mode),
        formatter: (p: { seriesName: string; data: { name: string; value: number[]; risk_score: number } }) =>
          t('gov.risk.chartTooltip', {
            name: p.data.name,
            domain: p.seriesName,
            level: p.data.value[1],
            usage: p.data.value[0],
            score: p.data.risk_score,
          }),
      },
      xAxis: {
        type: 'value',
        name: t('gov.risk.xAxisName'),
        nameLocation: 'middle',
        nameGap: 32,
        ...baseAxis(mode),
      },
      yAxis: {
        type: 'value',
        name: 'Maturity Level',
        nameLocation: 'middle',
        nameGap: 36,
        min: 0,
        ...baseAxis(mode),
      },
      series,
      // Quadrant hint directly on the chart -- usage high (right) x level
      // low (bottom) is the priority zone; a label right where the eye
      // already is teaches this faster than caption text ever could.
      graphic: rows.length
        ? [
            {
              type: 'text',
              right: 28,
              bottom: 64,
              style: {
                text: t('gov.risk.quadrantLabel'),
                fill: c.textMuted,
                fontSize: 11,
                fontFamily: FONT_FAMILY,
                textAlign: 'right',
                lineHeight: 15,
              },
              silent: true,
              z: 1,
            },
          ]
        : [],
    }
  }, [data, mode, c, maxRisk, t])

  const columns: GridColDef<RiskPriorityRow>[] = useMemo(
    () => [
      {
        field: 'name',
        headerName: t('gov.risk.colName'),
        flex: 1.3,
        renderCell: (params) => (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', height: '100%' }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: domainColor(params.row.domain, mode) }} />
            <Typography variant="body2">{params.value}</Typography>
          </Stack>
        ),
      },
      { field: 'domain', headerName: 'Domain', flex: 0.8 },
      {
        field: 'maturity_level',
        headerName: t('gov.risk.colLevel'),
        flex: 0.8,
        type: 'number',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <Typography variant="body2">L{params.value}</Typography>
          </Box>
        ),
      },
      {
        field: 'usage_30d',
        headerName: t('gov.risk.colUsage'),
        flex: 0.9,
        type: 'number',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <Typography variant="body2">{((params.value as number) ?? 0).toLocaleString()}</Typography>
          </Box>
        ),
      },
      {
        field: 'risk_score',
        headerName: t('gov.risk.colScore'),
        flex: 0.9,
        type: 'number',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {((params.value as number) ?? 0).toLocaleString()}
            </Typography>
          </Box>
        ),
      },
    ],
    [mode, t],
  )

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={0} sx={{ alignItems: 'center' }}>
          <Typography variant="subtitle1" gutterBottom sx={{ mb: 0 }}>
            {t('gov.risk.title')}
          </Typography>
          <InfoTooltip text={t('gov.risk.tooltip', { days: data?.usage_history_min_days ?? 7 })} />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
          {t('gov.risk.subtitle')}
        </Typography>
        <Box sx={{ height: 320 }}>
          <ReactECharts option={option} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
        </Box>
        <Box sx={{ height: 360, mt: 2 }}>
          <DataGrid
            rows={data?.top_risk ?? []}
            columns={columns}
            getRowId={(row) => row.id}
            density="comfortable"
            disableRowSelectionOnClick
            hideFooter
            onRowClick={(params) => setSelectedSubjectId(params.row.id)}
            sx={{ border: 0, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
          />
        </Box>
        {data && data.zombies.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {t('gov.risk.zombiesTitle')}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {data.zombies.map((z) => (
                <Chip
                  key={z.id}
                  size="small"
                  label={t('gov.risk.zombieChip', { name: z.name, level: z.maturity_level, usage: z.usage_30d ?? 0 })}
                  onClick={() => setSelectedSubjectId(z.id)}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Stack>
          </Box>
        )}
        {data && data.accumulating.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {t('gov.risk.accumulatingTitle', { days: data.usage_history_min_days })}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {data.accumulating.map((r) => (
                <Chip
                  key={r.id}
                  size="small"
                  variant="outlined"
                  label={t('gov.risk.accumulatingChip', {
                    name: r.name,
                    accumulated: r.usage_days_accumulated,
                    min: data.usage_history_min_days,
                  })}
                  onClick={() => setSelectedSubjectId(r.id)}
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
