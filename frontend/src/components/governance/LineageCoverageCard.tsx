import { useEffect, useState } from 'react'
import { Card, CardContent, Typography, Box, Stack, Chip } from '@mui/material'
import { api, type LineageCoverageResponse } from '../../api/client'
import { useStore } from '../../state/store'
import { domainColor } from '../../theme/palette'
import InfoTooltip from '../InfoTooltip'

export default function LineageCoverageCard() {
  const mode = useStore((s) => s.mode)
  const setSelectedSubjectId = useStore((s) => s.setSelectedSubjectId)
  const [data, setData] = useState<LineageCoverageResponse | null>(null)

  useEffect(() => {
    api.governanceLineageCoverage().then(setData)
  }, [])

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={0} sx={{ alignItems: 'center' }}>
          <Typography variant="subtitle1" gutterBottom sx={{ mb: 0 }}>
            Lineage 覆蓋率:出事時看不看得到影響範圍?
          </Typography>
          <InfoTooltip text="完全沒有 lineage 的資料集是「盲點」——壞掉的時候沒人知道會影響誰。下游依賴多但 Level 又低的資料集,一旦出問題影響會擴散最廣,應該優先補強。" />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
          有 lineage 記錄的資料集佔比
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 36, fontWeight: 600, lineHeight: 1 }}>
            {data ? `${data.coverage_pct}%` : '—'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {data ? `${data.covered} / ${data.total_subjects} 個 data subject 有 lineage 記錄` : ''}
          </Typography>
        </Box>

        {data && data.islands.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              完全沒有 lineage 的孤島({data.islands.length})
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {data.islands.map((i) => (
                <Chip
                  key={i.id}
                  size="small"
                  label={`${i.name} · ${i.domain}`}
                  onClick={() => setSelectedSubjectId(i.id)}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Stack>
          </Box>
        )}

        {data && data.risk_hubs.length > 0 && (
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              高影響力樞紐(下游依賴多、Level 卻偏低)
            </Typography>
            <Stack spacing={0.8}>
              {data.risk_hubs.slice(0, 6).map((h) => (
                <Stack
                  key={h.id}
                  direction="row"
                  sx={{ justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setSelectedSubjectId(h.id)}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: domainColor(h.domain, mode) }} />
                    <Typography variant="body2">{h.name}</Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {h.fan_out} 個下游依賴 · L{h.maturity_level}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
