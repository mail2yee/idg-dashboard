import { useEffect, useState } from 'react'
import { Card, CardContent, Typography, Box, Stack, Chip } from '@mui/material'
import { api, type LineageCoverageResponse } from '../../api/client'
import { useStore } from '../../state/store'
import { domainColor } from '../../theme/palette'
import InfoTooltip from '../InfoTooltip'
import { useT } from '../../i18n/useT'

export default function LineageCoverageCard() {
  const t = useT()
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
            {t('gov.lineage.title')}
          </Typography>
          <InfoTooltip text={t('gov.lineage.tooltip')} />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
          {t('gov.lineage.subtitle')}
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Typography sx={{ fontSize: 36, fontWeight: 600, lineHeight: 1 }}>
            {data ? `${data.coverage_pct}%` : '—'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {data ? t('gov.lineage.detail', { covered: data.covered, total: data.total_subjects }) : ''}
          </Typography>
        </Box>

        {data && data.islands.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {t('gov.lineage.islandsTitle', { n: data.islands.length })}
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
              {t('gov.lineage.hubsTitle')}
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
                    {t('gov.lineage.hubDetail', { fanOut: h.fan_out, level: h.maturity_level })}
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
