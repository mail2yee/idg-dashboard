import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  MenuItem,
  Autocomplete,
} from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import ReactECharts from 'echarts-for-react'
import {
  api,
  type DomainTrendSummary,
  type SubjectTrendSummary,
  type LevelDistribution,
  type Period,
} from '../api/client'
import { useStore } from '../state/store'
import { domainColor, DOMAIN_ORDER, categorical, chrome } from '../theme/palette'
import { getLevelColor } from '../theme/badges'
import { tooltipStyle, FONT_FAMILY, formatWeekLabel } from '../theme/echartsTheme'
import DeltaBadge from '../components/DeltaBadge'
import InfoTooltip from '../components/InfoTooltip'

type Scope = 'domain' | 'subject'

const PERIOD_LABELS: Record<Period, string> = { week: '週', month: '月', year: '年' }
const PERIOD_DELTA_LABELS: Record<Period, string> = { week: 'WoW', month: 'MoM', year: 'YoY' }

interface FocusedSeries {
  label: string
  dates: string[]
  values: number[]
}

interface FocusOption {
  key: string
  label: string
}

export default function TrendsPage() {
  const mode = useStore((s) => s.mode)
  const maxLevel = useStore((s) => s.maxLevel)
  const setSelectedSubjectId = useStore((s) => s.setSelectedSubjectId)
  const setSelectedDomainDetail = useStore((s) => s.setSelectedDomainDetail)
  const [scope, setScope] = useState<Scope>('domain')
  const [period, setPeriod] = useState<Period>('week')
  const [domainFilter, setDomainFilter] = useState('')
  const [search, setSearch] = useState('')
  const [domains, setDomains] = useState<DomainTrendSummary[]>([])
  const [subjects, setSubjects] = useState<SubjectTrendSummary[]>([])
  const [distribution, setDistribution] = useState<LevelDistribution | null>(null)
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState<FocusedSeries | null>(null)

  useEffect(() => {
    if (scope !== 'domain') return
    api.domainsTrendSummary(period).then((res) => setDomains(res.domains))
    api.domainsLevelDistribution(period).then(setDistribution)
    setFocused(null)
  }, [scope, period])

  useEffect(() => {
    if (scope !== 'subject') return
    setLoading(true)
    Promise.all([
      api.subjectsTrendSummary({ domain: domainFilter || undefined, search: search || undefined, period }),
      api.subjectsLevelDistribution({ domain: domainFilter || undefined, search: search || undefined, period }),
    ])
      .then(([trendRes, distRes]) => {
        setSubjects(trendRes.subjects)
        setDistribution(distRes)
      })
      .finally(() => setLoading(false))
    setFocused(null)
  }, [scope, domainFilter, search, period])

  async function focusOnDomain(name: string) {
    setSelectedDomainDetail(name)
    const detail = await api.domainDetail(name, period)
    setFocused({ label: name, dates: detail.series.map((p) => p.date), values: detail.series.map((p) => p.level) })
  }

  async function focusOnSubject(id: string, name: string) {
    setSelectedSubjectId(id)
    const res = await api.subjectTrend(id, period)
    setFocused({
      label: name,
      dates: res.trend.map((p) => p.snapshot_date),
      values: res.trend.map((p) => p.maturity_level),
    })
  }

  const focusOptions: FocusOption[] = useMemo(
    () =>
      scope === 'domain'
        ? domains.map((d) => ({ key: d.domain, label: d.domain }))
        : subjects.map((s) => ({ key: s.id, label: s.name })),
    [scope, domains, subjects],
  )

  function handleFocusChange(option: FocusOption | null) {
    if (!option) {
      setFocused(null)
      return
    }
    if (scope === 'domain') {
      focusOnDomain(option.key)
    } else {
      focusOnSubject(option.key, option.label)
    }
  }

  const c = chrome[mode]

  // Default view: stacked bar (composition) + an overlaid line per level, so
  // each level's own count trend is readable, not just the proportions.
  const distributionOption = useMemo(() => {
    if (!distribution) return null
    const levels = Object.keys(distribution.series)
      .map(Number)
      .sort((a, b) => a - b)
    const dateLabels = distribution.dates.map(formatWeekLabel)
    const unitLabel = scope === 'domain' ? '個 Domain 數' : '個 Data Subject 數'
    return {
      animation: false,
      grid: { left: 56, right: 24, top: 16, bottom: 78 },
      legend: {
        data: levels.map((l) => `L${l}`),
        bottom: 0,
        textStyle: { color: c.textSecondary, fontSize: 12, fontFamily: FONT_FAMILY },
      },
      tooltip: { trigger: 'axis', ...tooltipStyle(mode) },
      xAxis: {
        type: 'category',
        data: dateLabels,
        name: '週次(每個點代表一週的週一)',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: { color: c.textSecondary, fontSize: 12, fontFamily: FONT_FAMILY },
        axisLine: { lineStyle: { color: c.baseline } },
        axisTick: { show: false },
        axisLabel: {
          color: c.textMuted,
          fontSize: 11,
          fontFamily: FONT_FAMILY,
          interval: dateLabels.length > 20 ? Math.floor(dateLabels.length / 12) : 0,
          rotate: dateLabels.length > 20 ? 45 : 0,
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: unitLabel,
        nameLocation: 'middle',
        nameGap: 36,
        nameTextStyle: { color: c.textSecondary, fontSize: 12, fontFamily: FONT_FAMILY },
        axisLine: { lineStyle: { color: c.baseline } },
        axisTick: { show: false },
        axisLabel: { color: c.textMuted, fontSize: 12, fontFamily: FONT_FAMILY },
        splitLine: { lineStyle: { color: c.gridline } },
      },
      series: [
        ...levels.map((l) => ({
          name: `L${l}`,
          type: 'bar' as const,
          stack: 'total',
          data: distribution.series[String(l)],
          itemStyle: { color: getLevelColor(l), opacity: 0.55 },
          barMaxWidth: 26,
        })),
        ...levels.map((l) => ({
          name: `L${l}`,
          type: 'line' as const,
          data: distribution.series[String(l)],
          itemStyle: { color: getLevelColor(l) },
          lineStyle: { width: 2 },
          showSymbol: false,
          z: 10,
        })),
      ],
    }
  }, [distribution, mode, c, scope])

  const accent = categorical[mode][0]
  const focusedOption = useMemo(() => {
    if (!focused) return null
    const dateLabels = focused.dates.map(formatWeekLabel)
    return {
      animation: false,
      grid: { left: 56, right: 24, top: 16, bottom: 62 },
      tooltip: { trigger: 'axis', ...tooltipStyle(mode) },
      xAxis: {
        type: 'category',
        data: dateLabels,
        name: '週次(每個點代表一週的週一)',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: { color: c.textSecondary, fontSize: 12, fontFamily: FONT_FAMILY },
        axisLine: { lineStyle: { color: c.baseline } },
        axisTick: { show: false },
        axisLabel: {
          color: c.textMuted,
          fontSize: 11,
          fontFamily: FONT_FAMILY,
          interval: dateLabels.length > 20 ? Math.floor(dateLabels.length / 12) : 0,
          rotate: dateLabels.length > 20 ? 45 : 0,
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: maxLevel,
        name: 'Maturity Level',
        nameLocation: 'middle',
        nameGap: 36,
        nameTextStyle: { color: c.textSecondary, fontSize: 12, fontFamily: FONT_FAMILY },
        axisLine: { lineStyle: { color: c.baseline } },
        axisTick: { show: false },
        axisLabel: { color: c.textMuted, fontSize: 12, fontFamily: FONT_FAMILY },
        splitLine: { lineStyle: { color: c.gridline } },
      },
      series: [
        {
          type: 'line',
          data: focused.values,
          lineStyle: { width: 2, color: accent },
          itemStyle: { color: accent, borderColor: c.surface, borderWidth: 2 },
          showSymbol: focused.values.length <= 20,
          symbolSize: 6,
          areaStyle: { color: accent, opacity: 0.1 },
        },
      ],
    }
  }, [focused, mode, c, accent, maxLevel])

  const domainColumns: GridColDef<DomainTrendSummary>[] = useMemo(
    () => [
      {
        field: 'domain',
        headerName: 'Domain',
        flex: 1,
        renderCell: (params) => (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', height: '100%' }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: domainColor(params.value, mode) }} />
            <Typography variant="body2">{params.value}</Typography>
          </Stack>
        ),
      },
      {
        field: 'avg_maturity_level',
        headerName: '目前 Level',
        flex: 0.8,
        type: 'number',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <Typography variant="body2">L{(params.value as number).toFixed(2)}</Typography>
          </Box>
        ),
      },
      {
        field: 'delta',
        headerName: PERIOD_DELTA_LABELS[period],
        flex: 0.8,
        type: 'number',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <DeltaBadge value={params.value as number} mode={mode} />
          </Box>
        ),
      },
    ],
    [mode, period],
  )

  const subjectColumns: GridColDef<SubjectTrendSummary>[] = useMemo(
    () => [
      { field: 'name', headerName: 'Data Subject', flex: 1.2 },
      {
        field: 'domain',
        headerName: 'Domain',
        flex: 0.8,
        renderCell: (params) => (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', height: '100%' }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: domainColor(params.value, mode) }} />
            <Typography variant="body2">{params.value}</Typography>
          </Stack>
        ),
      },
      {
        field: 'maturity_level',
        headerName: '目前 Level',
        flex: 0.7,
        type: 'number',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <Typography variant="body2">L{params.value}</Typography>
          </Box>
        ),
      },
      {
        field: 'delta',
        headerName: PERIOD_DELTA_LABELS[period],
        flex: 0.7,
        type: 'number',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <DeltaBadge value={params.value as number} mode={mode} />
          </Box>
        ),
      },
    ],
    [mode, period],
  )

  return (
    <Box sx={{ p: 3, maxWidth: 1280, mx: 'auto' }}>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" sx={{ mb: 1, alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={0} sx={{ alignItems: 'center' }}>
              <Typography variant="subtitle1">
                {focused ? focused.label : scope === 'domain' ? `全部 Domain 的 Level 分佈` : `全部 Data Subject 的 Level 分佈`}
              </Typography>
              {!focused && (
                <InfoTooltip text="堆疊長條本身因為底線一直在跳動,不容易單獨看中間某個顏色的漲跌,所以每個 Level 又疊了一條粗線,單獨畫出「這個 Level 的數量」自己隨週次的走勢,方便追蹤單一 Level 是變多還是變少。" />
              )}
            </Stack>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Autocomplete
                size="small"
                options={focusOptions}
                value={focused ? focusOptions.find((o) => o.label === focused.label) ?? null : null}
                onChange={(_, val) => handleFocusChange(val)}
                isOptionEqualToValue={(a, b) => a.key === b.key}
                renderInput={(params) => (
                  <TextField {...params} label={`只看某個 ${scope === 'domain' ? 'Domain' : 'Data Subject'}`} />
                )}
                sx={{ width: 260 }}
              />
              <ToggleButtonGroup size="small" value={period} exclusive onChange={(_, v) => v && setPeriod(v)}>
                <ToggleButton value="week">週</ToggleButton>
                <ToggleButton value="month">月</ToggleButton>
                <ToggleButton value="year">年</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            {focused
              ? `過去 ${focused.dates.length} 週${period !== 'week' ? `(約${PERIOD_LABELS[period]}對比)` : ''}的 Maturity Level 趨勢`
              : `淺色堆疊長條 = 這週${scope === 'domain' ? 'Domain' : 'data subject'}總數在 5 個 Level 間的組成比例;粗線 = 各 Level 數量隨週次的走勢`}
          </Typography>
          <Box sx={{ height: 380 }}>
            {focused && focusedOption && (
              <ReactECharts option={focusedOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
            )}
            {!focused && distributionOption && (
              <ReactECharts option={distributionOption} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
            )}
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Typography variant="subtitle1">週 / 月 / 年變化 — {scope === 'domain' ? '依 Domain' : '依 Data Subject'}</Typography>
              <ToggleButtonGroup size="small" value={scope} exclusive onChange={(_, v) => v && setScope(v)}>
                <ToggleButton value="domain">依 Domain</ToggleButton>
                <ToggleButton value="subject">依 Data Subject</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
            {scope === 'subject' && (
              <Stack direction="row" spacing={1}>
                <TextField
                  size="small"
                  select
                  label="Domain"
                  value={domainFilter}
                  onChange={(e) => setDomainFilter(e.target.value)}
                  sx={{ width: 160 }}
                >
                  <MenuItem value="">全部</MenuItem>
                  {DOMAIN_ORDER.map((d) => (
                    <MenuItem key={d} value={d}>
                      {d}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  placeholder="搜尋 subject 名稱…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  sx={{ width: 220 }}
                />
              </Stack>
            )}
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            點欄位標題可依 {PERIOD_DELTA_LABELS[period]} 排序,快速看出進步最多或退步最多的{scope === 'domain' ? 'Domain' : 'data subject'}。
            點一列可以聚焦上方趨勢圖,也會開詳細成長狀況。
          </Typography>

          <Box sx={{ height: 420 }}>
            {scope === 'domain' ? (
              <DataGrid
                rows={domains}
                columns={domainColumns}
                getRowId={(row) => row.domain}
                density="comfortable"
                disableRowSelectionOnClick
                hideFooter
                onRowClick={(params) => focusOnDomain(params.row.domain)}
                sx={{ border: 0, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
              />
            ) : (
              <DataGrid
                rows={subjects}
                columns={subjectColumns}
                loading={loading}
                density="comfortable"
                disableRowSelectionOnClick
                onRowClick={(params) => focusOnSubject(params.row.id, params.row.name)}
                sx={{ border: 0, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
                initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
                pageSizeOptions={[10, 25, 50]}
              />
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
