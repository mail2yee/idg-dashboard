import { Stack, Typography } from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import RemoveIcon from '@mui/icons-material/Remove'
import { chrome, status, type Mode } from '../theme/palette'

export default function DeltaBadge({ value, mode }: { value: number; mode: Mode }) {
  const c = chrome[mode]
  const isFlat = Math.abs(value) < 0.005
  const isUp = value >= 0
  const color = isFlat ? c.textMuted : isUp ? c.successText : status.critical

  return (
    <Stack direction="row" spacing={0.3} sx={{ alignItems: 'center' }}>
      {isFlat ? (
        <RemoveIcon sx={{ fontSize: 14, color }} />
      ) : isUp ? (
        <ArrowUpwardIcon sx={{ fontSize: 14, color }} />
      ) : (
        <ArrowDownwardIcon sx={{ fontSize: 14, color }} />
      )}
      <Typography variant="body2" sx={{ color }}>
        {Math.abs(value).toFixed(2)}
      </Typography>
    </Stack>
  )
}
