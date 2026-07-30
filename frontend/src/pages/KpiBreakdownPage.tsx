import { useEffect, useState } from 'react'
import { Box, Card, CardContent, Typography, Stack, ToggleButtonGroup, ToggleButton, Grid, LinearProgress } from '@mui/material'
import { api, type DomainDimensionBreakdown, type Subject } from '../api/client'
import { useStore } from '../state/store'
import DimensionHeatmap from '../components/DimensionHeatmap'
import { categorical } from '../theme/palette'

type Scope = 'domain' | 'subject'

export default function KpiBreakdownPage() {
  const mode = useStore((s) => s.mode)
  const dims = useStore((s) => s.dimensions)
  const setSelectedDomainDetail = useStore((s) => s.setSelectedDomainDetail)
  const setSelectedSubjectId = useStore((s) => s.setSelectedSubjectId)
  const [scope, setScope] = useState<Scope>('domain')
  const [domains, setDomains] = useState<DomainDimensionBreakdown[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])

  useEffect(() => {
    api.domainsDimensionBreakdown().then((res) => setDomains(res.domains as unknown as DomainDimensionBreakdown[]))
    api.subjects({}).then((res) => setSubjects(res.subjects))
  }, [])

  const orgAverage: Record<string, number> = {}
  dims.forEach((d) => {
    const vals = domains.map((row) => (row as unknown as Record<string, number>)[d.key])
    orgAverage[d.key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  })

  const rows =
    scope === 'domain'
      ? domains.map((d) => ({ label: d.domain, values: d as unknown as Record<string, number> }))
      : subjects
          .filter((s) => s.sub_scores)
          .map((s) => ({ label: s.name, values: s.sub_scores as Record<string, number> }))

  return (
    <Box sx={{ p: 3, maxWidth: 1280, mx: 'auto' }}>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            各 KPI 全公司平均
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            這 {dims.length} 個面向是構成 Maturity Level(L1-L5)的底層 KPI,這裡單獨看每個面向目前大家的狀況,跟總覽頁的 Level 是兩個互補的視角。
          </Typography>
          <Grid container spacing={2}>
            {dims.map((d) => (
              <Grid size={{ xs: 12, sm: 6, md: 12 / dims.length }} key={d.key}>
                <Typography variant="caption" color="text.secondary">
                  {d.label}
                </Typography>
                <Typography variant="h6">{(orgAverage[d.key] ?? 0).toFixed(2)}</Typography>
                <LinearProgress
                  variant="determinate"
                  value={(orgAverage[d.key] ?? 0) * 100}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    bgcolor: 'action.hover',
                    '& .MuiLinearProgress-bar': { bgcolor: categorical[mode][0], borderRadius: 3 },
                  }}
                />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ mb: 1, alignItems: 'center' }}>
            <Typography variant="subtitle1">KPI 拆解 — {scope === 'domain' ? '依 Domain' : '依 Data Subject'}</Typography>
            <ToggleButtonGroup size="small" value={scope} exclusive onChange={(_, v) => v && setScope(v)}>
              <ToggleButton value="domain">依 Domain</ToggleButton>
              <ToggleButton value="subject">依 Data Subject</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
            顏色越深代表該面向分數越高,可以直接比較同一欄(同一個 KPI)在不同{scope === 'domain' ? 'Domain' : 'data subject'}的狀況。點一列可以看詳細狀況。
          </Typography>
          <DimensionHeatmap
            rows={rows}
            dims={dims}
            mode={mode}
            onRowClick={(label) =>
              scope === 'domain'
                ? setSelectedDomainDetail(label)
                : setSelectedSubjectId(subjects.find((s) => s.name === label)?.id ?? null)
            }
          />
        </CardContent>
      </Card>
    </Box>
  )
}
