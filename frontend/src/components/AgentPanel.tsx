import { useRef, useState, useEffect } from 'react'
import { Fab, Paper, Box, Stack, Typography, TextField, IconButton, Avatar, CircularProgress } from '@mui/material'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import CloseIcon from '@mui/icons-material/Close'
import SendIcon from '@mui/icons-material/Send'
import { api, type AgentResponse } from '../api/client'
import { useStore } from '../state/store'
import { categorical } from '../theme/palette'

const SUGGESTIONS = ['目前 data maturity 最高的三個部門?', '哪個部門排名最後?', '全公司過去的 maturity 趨勢?']

export default function AgentPanel() {
  const mode = useStore((s) => s.mode)
  const agentOpen = useStore((s) => s.agentOpen)
  const setAgentOpen = useStore((s) => s.setAgentOpen)
  const messages = useStore((s) => s.agentMessages)
  const addAgentMessage = useStore((s) => s.addAgentMessage)
  const clearFilters = useStore((s) => s.clearFilters)
  const setHighlightedDomains = useStore((s) => s.setHighlightedDomains)
  const setHighlightedSubjectIds = useStore((s) => s.setHighlightedSubjectIds)
  const setSelectedDomain = useStore((s) => s.setSelectedDomain)
  const setSelectedSubjectId = useStore((s) => s.setSelectedSubjectId)

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  function applyDirective(directive: AgentResponse['chart_directive']) {
    if (!directive) return
    switch (directive.type) {
      case 'highlight_domains':
        clearFilters()
        setHighlightedDomains(directive.domains as string[])
        break
      case 'highlight_subjects':
        clearFilters()
        setHighlightedSubjectIds(directive.subject_ids as string[])
        break
      case 'show_domain_ranking':
        clearFilters()
        break
      case 'show_trend':
        clearFilters()
        if (directive.domain) setSelectedDomain(directive.domain as string)
        break
      case 'open_subject_detail':
        setSelectedSubjectId(directive.subject_id as string)
        break
    }
  }

  async function send(question: string) {
    if (!question.trim() || sending) return
    addAgentMessage({ role: 'user', text: question })
    setInput('')
    setSending(true)
    try {
      const res = await api.agentQuery(question)
      addAgentMessage({ role: 'agent', text: res.answer_text })
      applyDirective(res.chart_directive)
    } catch {
      addAgentMessage({ role: 'agent', text: '查詢失敗,請稍後再試。' })
    } finally {
      setSending(false)
    }
  }

  const accent = categorical[mode][0]

  return (
    <>
      {agentOpen && (
        <Paper
          elevation={6}
          sx={{
            position: 'fixed',
            bottom: 96,
            right: 24,
            width: 360,
            height: 480,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 3,
            overflow: 'hidden',
            zIndex: 1300,
          }}
        >
          <Stack direction="row" spacing={1} sx={{ px: 2, py: 1.5, bgcolor: accent, color: '#fff', alignItems: 'center' }}>
            <SmartToyIcon fontSize="small" />
            <Typography variant="subtitle2" sx={{ flex: 1 }}>
              Data Quality Agent
            </Typography>
            <IconButton size="small" onClick={() => setAgentOpen(false)} sx={{ color: '#fff' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
            {messages.length === 0 && (
              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary">
                  試著問我:
                </Typography>
                {SUGGESTIONS.map((s) => (
                  <Paper
                    key={s}
                    variant="outlined"
                    sx={{ p: 1, cursor: 'pointer', fontSize: 13 }}
                    onClick={() => send(s)}
                  >
                    {s}
                  </Paper>
                ))}
              </Stack>
            )}
            <Stack spacing={1.2}>
              {messages.map((m, i) => (
                <Stack key={i} direction="row" sx={{ justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  {m.role === 'agent' && (
                    <Avatar sx={{ width: 24, height: 24, bgcolor: accent, mr: 1 }}>
                      <SmartToyIcon sx={{ fontSize: 14 }} />
                    </Avatar>
                  )}
                  <Paper
                    sx={{
                      p: 1,
                      px: 1.5,
                      maxWidth: '75%',
                      bgcolor: m.role === 'user' ? accent : 'action.hover',
                      color: m.role === 'user' ? '#fff' : 'text.primary',
                      borderRadius: 2,
                    }}
                  >
                    <Typography variant="body2">{m.text}</Typography>
                  </Paper>
                </Stack>
              ))}
              {sending && (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <CircularProgress size={14} />
                  <Typography variant="caption" color="text.secondary">
                    思考中…
                  </Typography>
                </Stack>
              )}
            </Stack>
          </Box>

          <Stack direction="row" spacing={1} sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <TextField
              size="small"
              fullWidth
              placeholder="問問資料狀況…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') send(input)
              }}
            />
            <IconButton color="primary" onClick={() => send(input)} disabled={sending}>
              <SendIcon />
            </IconButton>
          </Stack>
        </Paper>
      )}

      <Fab
        color="primary"
        onClick={() => setAgentOpen(!agentOpen)}
        sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1300 }}
      >
        <SmartToyIcon />
      </Fab>
    </>
  )
}
