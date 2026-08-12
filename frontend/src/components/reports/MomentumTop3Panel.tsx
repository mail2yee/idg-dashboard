import { Card, CardContent, Typography, Box, Stack } from '@mui/material'
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { status } from '../../theme/palette'

export interface Top3Row {
  domain: string
  secondaryLine: string
  primaryText: string
  deltaText: string
  deltaPositive: boolean
}

export default function MomentumTop3Panel({ title, rows }: { title: string; rows: Top3Row[] }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {title}
        </Typography>
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          {rows.map((r, i) => (
            <Stack key={r.domain} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  flexShrink: 0,
                  borderRadius: '50%',
                  bgcolor: `${status.warning}26`,
                  color: status.warning,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {i + 1}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                  {r.domain}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {r.secondaryLine}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {r.primaryText}
                </Typography>
                <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center', justifyContent: 'flex-end', color: r.deltaPositive ? status.good : status.critical }}>
                  {r.deltaPositive ? <ArrowDropUpIcon sx={{ fontSize: 18 }} /> : <ArrowDropDownIcon sx={{ fontSize: 18 }} />}
                  <Typography variant="caption" sx={{ color: 'inherit' }}>
                    {r.deltaText}
                  </Typography>
                </Stack>
              </Box>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  )
}
