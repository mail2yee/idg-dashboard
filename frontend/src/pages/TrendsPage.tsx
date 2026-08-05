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
import { useT } from '../i18n/useT'

type Scope = 'domain' | 'subject'

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
  const t = useT()
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
  const periodLabel = (p: Period) =>
    t(p === 'week' ? 'trends.periodWeek' : p === 'month' ? 'trends.periodMonth' : 'trends.periodYear')

  // Default view: stacked bar (composition) + an overlaid line per level, so
  // each level's own count trend is readable, not just the proportions.
  const distributionOption = useMemo(() => {
    if (!distribution) return null
    const levels = Object.keys(distribution.series)
      .map(Number)
      .sort((a, b) => a - b)
    const dateLabels = distribution.dates.map(formatWeekLabel)
    const unitLabel = t(scope === 'domain' ? 'trends.unitDomainCount' : 'trends.unitSubjectCount')
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
        name: t('trends.weekAxisLabel'),
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
          // Same name + same data as the bar series above -- an axis-
          // triggered tooltip shows every series regardless of name
          // collisions, so without this each level would show up twice
          // (once from the bar, once from this purely-visual line echo).
          tooltip: { show: false },
        })),
      ],
    }
  }, [distribution, mode, c, scope, t])

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
        name: t('trends.weekAxisLabel'),
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
  }, [focused, mode, c, accent, maxLevel, t])

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
        headerName: t('trends.currentScore'),
        flex: 0.8,
        type: 'number',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <Typography variant="body2">{(params.value as number).toFixed(2)}</Typography>
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
    [mode, period, t],
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
        headerName: t('trends.currentLevel'),
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
    [mode, period, t],
  )

  return (
    <Box sx={{ p: 3, maxWidth: 1280, mx: 'auto' }}>
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" sx={{ mb: 1, alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={0} sx={{ alignItems: 'center' }}>
              <Typography variant="subtitle1">
                {focused ? focused.label : t(scope === 'domain' ? 'trends.viewingAllDomains' : 'trends.viewingAllSubjects')}
              </Typography>
              {!focused && <InfoTooltip text={t('trends.stackedTooltip')} />}
            </Stack>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Autocomplete
                size="small"
                options={focusOptions}
                value={focused ? focusOptions.find((o) => o.label === focused.label) ?? null : null}
                onChange={(_, val) => handleFocusChange(val)}
                isOptionEqualToValue={(a, b) => a.key === b.key}
                renderInput={(params) => (
                  <TextField {...params} label={t(scope === 'domain' ? 'trends.viewOnlyDomain' : 'trends.viewOnlySubject')} />
                )}
                sx={{ width: 260 }}
              />
              <ToggleButtonGroup size="small" value={period} exclusive onChange={(_, v) => v && setPeriod(v)}>
                <ToggleButton value="week">{t('trends.periodWeek')}</ToggleButton>
                <ToggleButton value="month">{t('trends.periodMonth')}</ToggleButton>
                <ToggleButton value="year">{t('trends.periodYear')}</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            {focused
              ? t('trends.focusedTrend', {
                  n: focused.dates.length,
                  compare: period !== 'week' ? t('trends.periodCompareSuffix', { period: periodLabel(period) }) : '',
                })
              : t('trends.stackedCaption', { scope: scope === 'domain' ? 'Domain' : 'data subject' })}
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
              <Typography variant="subtitle1">
                {t('trends.headerPrefix')}
                {t(scope === 'domain' ? 'trends.scopeByDomain' : 'trends.scopeBySubject')}
              </Typography>
              <ToggleButtonGroup size="small" value={scope} exclusive onChange={(_, v) => v && setScope(v)}>
                <ToggleButton value="domain">{t('trends.scopeByDomain')}</ToggleButton>
                <ToggleButton value="subject">{t('trends.scopeBySubject')}</ToggleButton>
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
                  <MenuItem value="">{t('trends.domainFilterAll')}</MenuItem>
                  {DOMAIN_ORDER.map((d) => (
                    <MenuItem key={d} value={d}>
                      {d}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  size="small"
                  placeholder={t('subjects.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  sx={{ width: 220 }}
                />
              </Stack>
            )}
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            {t('trends.sortHint', {
              delta: PERIOD_DELTA_LABELS[period],
              scope: scope === 'domain' ? 'Domain' : 'data subject',
            })}
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
