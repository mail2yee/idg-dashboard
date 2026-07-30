import { useEffect, useState } from 'react'
import { Drawer, Box, Typography, IconButton, Stack, Divider, LinearProgress, List, ListItemButton, Chip } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import BusinessIcon from '@mui/icons-material/Business'
import ReactECharts from 'echarts-for-react'
import { api, type OwnerTeamDetail } from '../api/client'
import { useStore } from '../state/store'
import { chrome, categorical, domainColor } from '../theme/palette'
import { baseAxis, tooltipStyle } from '../theme/echartsTheme'
import DeltaBadge from './DeltaBadge'

export default function OwnerTeamDetailDrawer() {
  const mode = useStore((s) => s.mode)
  const maxScore = useStore((s) => s.maxScore)
  const dimensionLabels = useStore((s) => s.dimensions)
  const selectedOwnerTeamDetail = useStore((s) => s.selectedOwnerTeamDetail)
  const setSelectedOwnerTeamDetail = useStore((s) => s.setSelectedOwnerTeamDetail)
  const setSelectedSubjectId = useStore((s) => s.setSelectedSubjectId)
  const [detail, setDetail] = useState<OwnerTeamDetail | null>(null)

  useEffect(() => {
    if (!selectedOwnerTeamDetail) {
      setDetail(null)
      return
    }
    api.ownerTeamDetail(selectedOwnerTeamDetail).then(setDetail)
  }, [selectedOwnerTeamDetail])

  const c = chrome[mode]
  const accent = categorical[mode][0]

  const trendOption = detail && {
    animation: false,
    grid: { left: 32, right: 16, top: 16, bottom: 24 },
    tooltip: { trigger: 'axis', ...tooltipStyle(mode) },
    xAxis: {
      type: 'category',
      data: detail.series.map((t) => t.date.slice(5, 10)),
      ...baseAxis(mode),
      splitLine: { show: false },
    },
    yAxis: { type: 'value', min: 0, max: maxScore, ...baseAxis(mode) },
    series: [
      {
        type: 'line',
        data: detail.series.map((t) => t.score),
        lineStyle: { width: 2, color: accent },
        itemStyle: { color: accent, borderColor: c.surface, borderWidth: 2 },
        showSymbol: true,
        symbolSize: 8,
        areaStyle: { color: accent, opacity: 0.1 },
      },
    ],
  }

  return (
    <Drawer anchor="right" open={Boolean(selectedOwnerTeamDetail)} onClose={() => setSelectedOwnerTeamDetail(null)}>
      <Box sx={{ width: 440, p: 3 }}>
        {detail && (
          <>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Stack direction="row" spacing={0.8} sx={{ alignItems: 'center' }}>
                <BusinessIcon fontSize="small" />
                <Typography variant="h6">{detail.team}</Typography>
              </Stack>
              <IconButton onClick={() => setSelectedOwnerTeamDetail(null)}>
                <CloseIcon />
              </IconButton>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              依 Data Owner 所屬單位聚合(Data Steward / IT Owner 個別姓名只會出現在單一 subject 的詳情裡)
            </Typography>

            <Stack direction="row" spacing={3} sx={{ mt: 1.5, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                目前 {detail.avg_maturity_score.toFixed(2)} / {maxScore}
              </Typography>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  WoW
                </Typography>
                <DeltaBadge value={detail.wow_delta} mode={mode} />
              </Stack>
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  MoM
                </Typography>
                <DeltaBadge value={detail.mom_delta} mode={mode} />
              </Stack>
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom>
              過去 8 週趨勢
            </Typography>
            <Box sx={{ height: 160 }}>
              {trendOption && <ReactECharts option={trendOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />}
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom>
              旗下 subjects 平均 {maxScore} 分制拆解
            </Typography>
            <Stack spacing={1.2}>
              {Object.entries(detail.avg_sub_scores).map(([key, value]) => (
                <Box key={key}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                    <Stack direction="row" spacing={0.6} sx={{ alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        {dimensionLabels.find((d) => d.key === key)?.label ?? key}
                      </Typography>
                      {dimensionLabels.find((d) => d.key === key)?.responsible_role && (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={dimensionLabels.find((d) => d.key === key)?.responsible_role}
                          sx={{ height: 16, fontSize: 10, '& .MuiChip-label': { px: 0.6 } }}
                        />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {value.toFixed(2)}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={value * 100}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: 'action.hover',
                      '& .MuiLinearProgress-bar': { bgcolor: accent, borderRadius: 3 },
                    }}
                  />
                </Box>
              ))}
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom>
              名下 Data Subjects ({detail.subjects.length})
            </Typography>
            <List dense disablePadding>
              {detail.subjects.map((s) => (
                <ListItemButton
                  key={s.id}
                  sx={{ px: 0 }}
                  onClick={() => {
                    setSelectedOwnerTeamDetail(null)
                    setSelectedSubjectId(s.id)
                  }}
                >
                  <Stack direction="row" sx={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: domainColor(s.domain, mode) }} />
                      <Typography variant="body2">{s.name}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {s.maturity_score.toFixed(2)}
                      </Typography>
                      <DeltaBadge value={s.wow_delta} mode={mode} />
                    </Stack>
                  </Stack>
                </ListItemButton>
              ))}
            </List>
          </>
        )}
      </Box>
    </Drawer>
  )
}
