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
} from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { api, type DomainTrendSummary, type SubjectTrendSummary } from '../api/client'
import { useStore } from '../state/store'
import { domainColor, DOMAIN_ORDER } from '../theme/palette'
import Sparkline from '../components/Sparkline'
import DeltaBadge from '../components/DeltaBadge'

type Scope = 'domain' | 'subject'

export default function TrendsPage() {
  const mode = useStore((s) => s.mode)
  const maxScore = useStore((s) => s.maxScore)
  const setSelectedSubjectId = useStore((s) => s.setSelectedSubjectId)
  const setSelectedDomainDetail = useStore((s) => s.setSelectedDomainDetail)
  const [scope, setScope] = useState<Scope>('domain')
  const [domainFilter, setDomainFilter] = useState('')
  const [search, setSearch] = useState('')
  const [domains, setDomains] = useState<DomainTrendSummary[]>([])
  const [subjects, setSubjects] = useState<SubjectTrendSummary[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (scope !== 'domain') return
    api.domainsTrendSummary().then((res) => setDomains(res.domains))
  }, [scope])

  useEffect(() => {
    if (scope !== 'subject') return
    setLoading(true)
    api
      .subjectsTrendSummary({ domain: domainFilter || undefined, search: search || undefined })
      .then((res) => setSubjects(res.subjects))
      .finally(() => setLoading(false))
  }, [scope, domainFilter, search])

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
        field: 'avg_maturity_score',
        headerName: '目前分數',
        flex: 0.8,
        type: 'number',
        renderCell: (params) => <Typography variant="body2">{(params.value as number).toFixed(2)}</Typography>,
      },
      {
        field: 'wow_delta',
        headerName: '週對週 (WoW)',
        flex: 1,
        type: 'number',
        renderCell: (params) => <DeltaBadge value={params.value as number} mode={mode} />,
      },
      {
        field: 'mom_delta',
        headerName: '月對月 (MoM)',
        flex: 1,
        type: 'number',
        renderCell: (params) => <DeltaBadge value={params.value as number} mode={mode} />,
      },
      {
        field: 'series',
        headerName: '過去 8 週',
        flex: 1,
        sortable: false,
        renderCell: (params) => (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
            <Sparkline data={params.value as number[]} mode={mode} max={maxScore} width="100%" height={32} />
          </Box>
        ),
      },
    ],
    [mode],
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
        field: 'maturity_score',
        headerName: '目前分數',
        flex: 0.7,
        type: 'number',
        renderCell: (params) => <Typography variant="body2">{(params.value as number).toFixed(2)}</Typography>,
      },
      {
        field: 'wow_delta',
        headerName: '週對週 (WoW)',
        flex: 0.9,
        type: 'number',
        renderCell: (params) => <DeltaBadge value={params.value as number} mode={mode} />,
      },
      {
        field: 'mom_delta',
        headerName: '月對月 (MoM)',
        flex: 0.9,
        type: 'number',
        renderCell: (params) => <DeltaBadge value={params.value as number} mode={mode} />,
      },
      {
        field: 'series',
        headerName: '過去 8 週',
        flex: 1,
        sortable: false,
        renderCell: (params) => (
          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
            <Sparkline data={params.value as number[]} mode={mode} max={maxScore} width="100%" height={32} />
          </Box>
        ),
      },
    ],
    [mode],
  )

  return (
    <Box sx={{ p: 3, maxWidth: 1280, mx: 'auto' }}>
      <Card>
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Typography variant="subtitle1">週 / 月變化 — {scope === 'domain' ? '依部門' : '依 Data Subject'}</Typography>
              <ToggleButtonGroup
                size="small"
                value={scope}
                exclusive
                onChange={(_, v) => v && setScope(v)}
              >
                <ToggleButton value="domain">依部門</ToggleButton>
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
            點欄位標題可依 WoW / MoM 排序,快速看出進步最多或退步最多的{scope === 'domain' ? '部門' : 'data subject'}。
            點一列可以看詳細成長狀況。
          </Typography>

          <Box sx={{ height: 520 }}>
            {scope === 'domain' ? (
              <DataGrid
                rows={domains}
                columns={domainColumns}
                getRowId={(row) => row.domain}
                density="comfortable"
                disableRowSelectionOnClick
                hideFooter
                onRowClick={(params) => setSelectedDomainDetail(params.row.domain)}
                sx={{ border: 0, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
              />
            ) : (
              <DataGrid
                rows={subjects}
                columns={subjectColumns}
                loading={loading}
                density="comfortable"
                disableRowSelectionOnClick
                onRowClick={(params) => setSelectedSubjectId(params.row.id)}
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
