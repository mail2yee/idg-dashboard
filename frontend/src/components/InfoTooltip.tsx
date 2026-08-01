import { Tooltip, IconButton, Typography } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

// Two-tier metric explanation, used next to every card/chart title: the
// caption text beside this stays to one short line ("what this is / how
// it's calculated"); the longer "why it matters / how to read this" text
// goes here instead, so the default view stays clean and the explanation
// is still one click away, not gone.
export default function InfoTooltip({ text }: { text: string }) {
  return (
    <Tooltip
      title={
        <Typography variant="caption" sx={{ display: 'block', whiteSpace: 'pre-line', fontSize: 12 }}>
          {text}
        </Typography>
      }
      arrow
      placement="right"
    >
      <IconButton size="small" sx={{ p: 0.25, color: 'text.secondary', verticalAlign: 'middle' }}>
        <InfoOutlinedIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
  )
}
