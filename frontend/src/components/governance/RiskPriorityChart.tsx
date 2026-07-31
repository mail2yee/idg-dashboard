import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, Typography, Box, Stack, Chip } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import ReactECharts from 'echarts-for-react'
import { api, type RiskPriorityResponse, type RiskPriorityRow } from '../../api/client'
import { useStore } from '../../state/store'
import { chrome, domainColor, DOMAIN_ORDER } from '../../theme/palette'
import { baseAxis, tooltipStyle, FONT_FAMILY } from '../../theme/echartsTheme'

export default function RiskPriorityChart() {
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
      grid: { left: 56, right: 24, top: 16, bottom: 56 },
      legend: {
        top: 0,
        left: 0,
        textStyle: { color: c.textSecondary, fontSize: 12, fontFamily: FONT_FAMILY },
        icon: 'circle',
      },
      tooltip: {
        trigger: 'item',
        ...tooltipStyle(mode),
        formatter: (p: { seriesName: string; data: { name: string; value: number[]; risk_score: number } }) =>
          `${p.data.name}(${p.seriesName})<br/>Level L${p.data.value[1]} · 累積查詢 ${p.data.value[0]}<br/>風險分數 ${p.data.risk_score}`,
      },
      xAxis: {
        type: 'value',
        name: '累積查詢次數(usage,最多近 30 天)',
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
    }
  }, [data, mode, c, maxRisk])

  const columns: GridColDef<RiskPriorityRow>[] = useMemo(
    () => [
      {
        field: 'name',
        headerName: '資料集',
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
        headerName: '目前 Level',
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
        headerName: '累積查詢量',
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
        headerName: '風險分數',
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
    [mode],
  )

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom>
          風險優先排序:誰該先救?
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
          風險分數 = 累積使用量 × 距離 L5 的差距。使用量高但 Level 低的資料集(圖上偏右下、泡泡越大)代表一旦出問題影響範圍最廣,應該優先處理;而不是單純看誰的 Level 最低。
          使用量是每天從 DataHub 同步一筆、自己累積起來的,不是一次拿到 30 天——新收錄的資料集要等累積滿 {data?.usage_history_min_days ?? 7} 天才會出現在排名裡。
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
              治理做得不錯但幾乎沒人用(可評估下架/整併)
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {data.zombies.map((z) => (
                <Chip
                  key={z.id}
                  size="small"
                  label={`${z.name} · L${z.maturity_level} · ${z.usage_30d} 次`}
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
              資料累積中(使用量歷史還不足 {data.usage_history_min_days} 天,尚未列入排序)
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {data.accumulating.map((r) => (
                <Chip
                  key={r.id}
                  size="small"
                  variant="outlined"
                  label={`${r.name} · ${r.usage_days_accumulated}/${data.usage_history_min_days} 天`}
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
