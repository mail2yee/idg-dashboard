import { useEffect, useState } from 'react'
import { Card, CardContent, Typography, Stack, Chip, TextField, Box } from '@mui/material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import { api, type Subject } from '../api/client'
import { useStore } from '../state/store'
import { domainColor } from '../theme/palette'

export default function SubjectTable() {
  const mode = useStore((s) => s.mode)
  const maxScore = useStore((s) => s.maxScore)
  const selectedDomain = useStore((s) => s.selectedDomain)
  const scoreRange = useStore((s) => s.scoreRange)
  const search = useStore((s) => s.search)
  const setSearch = useStore((s) => s.setSearch)
  const highlightedSubjectIds = useStore((s) => s.highlightedSubjectIds)
  const setSelectedSubjectId = useStore((s) => s.setSelectedSubjectId)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api
      .subjects({
        domain: selectedDomain ?? undefined,
        min_score: scoreRange?.[0],
        max_score: scoreRange?.[1],
        search: search || undefined,
      })
      .then((res) => setSubjects(res.subjects))
      .finally(() => setLoading(false))
  }, [selectedDomain, scoreRange, search])

  const columns: GridColDef<Subject>[] = [
    {
      field: 'name',
      headerName: 'Data Subject',
      flex: 1.4,
      renderCell: (params) => (
        <Typography variant="body2" sx={{ fontWeight: highlightedSubjectIds.includes(params.row.id) ? 700 : 400 }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'domain',
      headerName: 'Domain',
      flex: 0.9,
      renderCell: (params) => (
        <Chip
          size="small"
          label={params.value}
          sx={{
            bgcolor: domainColor(params.value, mode),
            color: '#fff',
            fontWeight: 500,
          }}
        />
      ),
    },
    { field: 'platform', headerName: 'Platform', flex: 0.7 },
    {
      field: 'maturity_score',
      headerName: 'Maturity',
      flex: 0.9,
      renderCell: (params) => {
        const score = params.value as number | null
        return (
          <Stack direction="row" spacing={1} sx={{ width: '100%', alignItems: 'center' }}>
            <Box sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: 'action.hover', overflow: 'hidden' }}>
              <Box
                sx={{
                  width: `${((score ?? 0) / maxScore) * 100}%`,
                  height: '100%',
                  bgcolor:
                    (score ?? 0) >= maxScore * 0.8 ? '#0ca30c' : (score ?? 0) >= maxScore * 0.5 ? '#fab219' : '#d03b3b',
                }}
              />
            </Box>
            <Typography variant="caption" sx={{ minWidth: 28 }}>
              {score?.toFixed(1) ?? '—'}
            </Typography>
          </Stack>
        )
      },
    },
    {
      field: 'is_deprecated',
      headerName: 'Status',
      flex: 0.7,
      renderCell: (params) => (
        <Chip
          size="small"
          variant="outlined"
          color={params.value ? 'default' : 'success'}
          label={params.value ? 'Deprecated' : 'Active'}
        />
      ),
    },
  ]

  return (
    <Card>
      <CardContent>
        <Stack direction="row" sx={{ mb: 1, justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle2">Data Subjects ({subjects.length})</Typography>
          <TextField
            size="small"
            placeholder="搜尋 subject 名稱…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: 240 }}
          />
        </Stack>
        <Box sx={{ height: 420 }}>
          <DataGrid
            rows={subjects}
            columns={columns}
            loading={loading}
            density="compact"
            disableRowSelectionOnClick
            onRowClick={(params) => setSelectedSubjectId(params.row.id)}
            getRowClassName={(params) =>
              highlightedSubjectIds.includes(params.row.id) ? 'row-highlighted' : ''
            }
            sx={{
              border: 0,
              '& .row-highlighted': { bgcolor: 'action.selected' },
              '& .MuiDataGrid-row': { cursor: 'pointer' },
            }}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            pageSizeOptions={[10, 25, 50]}
          />
        </Box>
      </CardContent>
    </Card>
  )
}
