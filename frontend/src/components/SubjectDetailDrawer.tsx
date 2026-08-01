import { useEffect, useState } from 'react'
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Stack,
  Chip,
  Divider,
  LinearProgress,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import ReactECharts from 'echarts-for-react'
import { api, type SubjectDetail, type MaturitySnapshot } from '../api/client'
import { useStore } from '../state/store'
import { chrome, categorical, status, domainColor } from '../theme/palette'
import { getLevelColor } from '../theme/badges'
import { baseAxis, tooltipStyle, formatWeekLabel } from '../theme/echartsTheme'
import InfoTooltip from './InfoTooltip'

const ROLE_LABELS: Record<string, string> = {
  DATA_OWNER: 'Data Owner',
  DATA_STEWARD: 'Data Steward',
  IT_OWNER: 'IT Owner',
}
const ROLE_ORDER = ['DATA_OWNER', 'DATA_STEWARD', 'IT_OWNER']

export default function SubjectDetailDrawer() {
  const mode = useStore((s) => s.mode)
  const maxLevel = useStore((s) => s.maxLevel)
  const dimensionLabels = useStore((s) => s.dimensions)
  const selectedSubjectId = useStore((s) => s.selectedSubjectId)
  const setSelectedSubjectId = useStore((s) => s.setSelectedSubjectId)
  const [detail, setDetail] = useState<SubjectDetail | null>(null)
  const [trend, setTrend] = useState<MaturitySnapshot[]>([])

  useEffect(() => {
    if (!selectedSubjectId) return
    api.subjectDetail(selectedSubjectId).then(setDetail)
    api.subjectTrend(selectedSubjectId).then((res) => setTrend(res.trend))
  }, [selectedSubjectId])

  const c = chrome[mode]
  const accent = categorical[mode][0]

  const trendOption = {
    animation: false,
    grid: { left: 32, right: 16, top: 16, bottom: 24 },
    tooltip: { trigger: 'axis', ...tooltipStyle(mode) },
    xAxis: {
      type: 'category',
      data: trend.map((t) => formatWeekLabel(t.snapshot_date)),
      ...baseAxis(mode),
      splitLine: { show: false },
    },
    yAxis: { type: 'value', min: 0, max: maxLevel, ...baseAxis(mode) },
    series: [
      {
        type: 'line',
        data: trend.map((t) => t.maturity_level),
        lineStyle: { width: 2, color: accent },
        itemStyle: { color: accent, borderColor: c.surface, borderWidth: 2 },
        showSymbol: true,
        symbolSize: 8,
        areaStyle: { color: accent, opacity: 0.1 },
      },
    ],
  }

  return (
    <Drawer anchor="right" open={Boolean(selectedSubjectId)} onClose={() => setSelectedSubjectId(null)}>
      <Box sx={{ width: 440, p: 3 }}>
        {detail && (
          <>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Typography variant="h6">{detail.subject.name}</Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5, alignItems: 'center' }}>
                  <Chip
                    size="small"
                    label={detail.subject.domain}
                    sx={{ bgcolor: domainColor(detail.subject.domain, mode), color: '#fff' }}
                  />
                  {detail.snapshot && (
                    <Chip
                      size="small"
                      icon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: getLevelColor(detail.snapshot.maturity_level), ml: 1 }} />}
                      label={`L${detail.snapshot.maturity_level}`}
                      variant="outlined"
                    />
                  )}
                </Stack>
              </Box>
              <IconButton onClick={() => setSelectedSubjectId(null)}>
                <CloseIcon />
              </IconButton>
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              {detail.subject.description || '（無 description）'}
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom>
              Maturity Level Trend
            </Typography>
            <Box sx={{ height: 160 }}>
              <ReactECharts option={trendOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
            </Box>

            <Divider sx={{ my: 2 }} />

            <Stack direction="row" spacing={0} sx={{ alignItems: 'center' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ mb: 0 }}>
                KPI 拆解(構成 Maturity Level 的底層指標)
              </Typography>
              <InfoTooltip text="這裡是連續分數(0-1),跟上面的 Maturity Level 階梯是互補視角——Level 卡在某一級時,這裡可以看出是哪個面向拖累的。" />
            </Stack>
            <Stack spacing={1.2}>
              {detail.snapshot &&
                Object.entries(detail.snapshot.sub_scores).map(([key, value]) => (
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
                        {(value as number).toFixed(2)}
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={(value as number) * 100}
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
              負責人
            </Typography>
            <Stack spacing={0.8} sx={{ mb: 1 }}>
              {ROLE_ORDER.map((role) => {
                const owner = detail.subject.owners.find((o) => o.role === role)
                return (
                  <Stack key={role} direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      {ROLE_LABELS[role]}
                    </Typography>
                    {owner ? (
                      <Typography variant="body2">
                        {owner.name} · {owner.team}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        未指派
                      </Typography>
                    )}
                  </Stack>
                )
              })}
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" gutterBottom>
              Assertions ({detail.assertions.length})
            </Typography>
            <Stack spacing={0.5} sx={{ mb: 2 }}>
              {detail.assertions.length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  尚未設置任何 assertion
                </Typography>
              )}
              {detail.assertions.map((a) => (
                <Stack key={a.id as string} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  {a.last_run_status === 'PASS' ? (
                    <CheckCircleIcon sx={{ fontSize: 16, color: status.good }} />
                  ) : (
                    <CancelIcon sx={{ fontSize: 16, color: status.critical }} />
                  )}
                  <Typography variant="body2">
                    {a.type as string} — {a.last_run_status as string}
                  </Typography>
                </Stack>
              ))}
            </Stack>

            <Typography variant="subtitle2" gutterBottom>
              Incidents ({detail.incidents.length})
            </Typography>
            <Stack spacing={0.5}>
              {detail.incidents.length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  沒有 incident 紀錄
                </Typography>
              )}
              {detail.incidents.map((i) => (
                <Stack key={i.id as string} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  {i.status === 'RESOLVED' ? (
                    <CheckCircleIcon sx={{ fontSize: 16, color: status.good }} />
                  ) : (
                    <CancelIcon sx={{ fontSize: 16, color: status.critical }} />
                  )}
                  <Typography variant="body2">
                    {i.title as string} — {i.status as string}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </>
        )}
      </Box>
    </Drawer>
  )
}
