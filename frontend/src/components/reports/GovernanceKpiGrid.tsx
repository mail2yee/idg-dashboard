import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, Typography, Box, Stack, Chip } from '@mui/material'
import { AgGridReact } from 'ag-grid-react'
import { themeQuartz, colorSchemeDark, type ColDef, type ICellRendererParams } from 'ag-grid-community'
import {
  api,
  type Subject,
  type OwnershipCoverageResponse,
  type LineageCoverageResponse,
  type StewardshipResponse,
  type OrgSnapshot,
} from '../../api/client'
import { useStore } from '../../state/store'
import { chrome, status } from '../../theme/palette'
import { useT } from '../../i18n/useT'

const READY_THRESHOLD = 0.7

function ReadyDot({ ready }: { ready: boolean }) {
  return (
    <Box
      sx={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        mx: 'auto',
        bgcolor: ready ? status.good : 'transparent',
        border: ready ? 'none' : `1.5px solid ${status.good}`,
      }}
    />
  )
}

export default function GovernanceKpiGrid({ domainFilter }: { domainFilter: string | null }) {
  const t = useT()
  const mode = useStore((s) => s.mode)
  const dimensions = useStore((s) => s.dimensions)
  const [ownership, setOwnership] = useState<OwnershipCoverageResponse | null>(null)
  const [lineage, setLineage] = useState<LineageCoverageResponse | null>(null)
  const [stewardship, setStewardship] = useState<StewardshipResponse | null>(null)
  const [global, setGlobal] = useState<OrgSnapshot | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])

  useEffect(() => {
    api.governanceOwnershipCoverage().then(setOwnership)
    api.governanceLineageCoverage().then(setLineage)
    api.governanceStewardship().then(setStewardship)
    api.maturitySummary().then((res) => setGlobal(res.latest))
  }, [])

  useEffect(() => {
    api.subjects({ domain: domainFilter ?? undefined }).then((res) => setSubjects(res.subjects))
  }, [domainFilter])

  const c = chrome[mode]

  const stewardshipOnTimePct = useMemo(() => {
    const teams = stewardship?.teams ?? []
    const open = teams.reduce((s, tm) => s + tm.open_count, 0)
    const overdue = teams.reduce((s, tm) => s + tm.overdue_count, 0)
    if (open === 0) return 100
    return Math.round((1 - overdue / open) * 1000) / 10
  }, [stewardship])

  const { abovePct, belowPct } = useMemo(() => {
    const levels = subjects.map((s) => s.maturity_level).filter((v): v is number => v !== null)
    if (levels.length === 0) return { abovePct: 0, belowPct: 0 }
    const above = levels.filter((v) => v > 4).length
    const below = levels.filter((v) => v < 2).length
    return {
      abovePct: Math.round((above / levels.length) * 1000) / 10,
      belowPct: Math.round((below / levels.length) * 1000) / 10,
    }
  }, [subjects])

  const theme = useMemo(() => {
    const base = themeQuartz.withParams({
      backgroundColor: c.surface,
      foregroundColor: c.textPrimary,
      borderColor: c.gridline,
      headerTextColor: c.textSecondary,
      rowHoverColor: c.page,
    })
    return mode === 'dark' ? base.withPart(colorSchemeDark) : base
  }, [mode, c])

  const columnDefs = useMemo<ColDef<Subject>[]>(() => {
    const cols: ColDef<Subject>[] = [
      { field: 'name', headerName: t('reports.grid.colName'), flex: 1.4 },
      { field: 'domain', headerName: t('reports.grid.colDomain'), flex: 0.8 },
      {
        field: 'maturity_level',
        headerName: t('reports.grid.colMaturity'),
        flex: 0.8,
        valueFormatter: (p) => (p.value == null ? '—' : `L${p.value}`),
        cellStyle: (p) => ({
          color: p.value != null && p.value > 4 ? status.good : p.value != null && p.value < 2 ? status.critical : c.textPrimary,
          fontWeight: 600,
        }),
      },
    ]
    for (const dim of dimensions) {
      cols.push({
        colId: dim.key,
        headerName: dim.label,
        flex: 0.7,
        cellRenderer: (p: ICellRendererParams<Subject>) => {
          const score = p.data?.sub_scores?.[dim.key] ?? 0
          return <ReadyDot ready={score >= READY_THRESHOLD} />
        },
      })
    }
    return cols
  }, [dimensions, t, c])

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom sx={{ mb: 1.5 }}>
          {t('reports.grid.title')}
        </Typography>

        <Stack direction="row" spacing={4} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1.5 }}>
          <KpiStat label={t('reports.grid.ownership')} value={ownership ? `${ownership.coverage_pct}%` : '—'} />
          <KpiStat label={t('reports.grid.lineage')} value={lineage ? `${lineage.coverage_pct}%` : '—'} />
          <KpiStat label={t('reports.grid.dataQuality')} value={global ? `${global.data_quality_index}%` : '—'} />
          <KpiStat label={t('reports.grid.stewardship')} value={`${stewardshipOnTimePct}%`} />
        </Stack>

        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
          <Chip size="small" label={t('reports.grid.chipAbove', { pct: abovePct })} sx={{ bgcolor: `${status.good}22`, color: status.good }} />
          <Chip size="small" label={t('reports.grid.chipBelow', { pct: belowPct })} sx={{ bgcolor: `${status.critical}22`, color: status.critical }} />
        </Stack>

        <Box sx={{ height: 320 }}>
          <AgGridReact
            theme={theme}
            rowData={subjects}
            columnDefs={columnDefs}
            getRowId={(p) => p.data.id}
            defaultColDef={{ resizable: true, sortable: true }}
            rowHeight={38}
            headerHeight={36}
          />
        </Box>
      </CardContent>
    </Card>
  )
}

function KpiStat({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 22, fontWeight: 600, lineHeight: 1.1 }}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  )
}
