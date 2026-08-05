import { useRef, useState, useEffect } from 'react'
import { Fab, Paper, Box, Stack, Typography, TextField, IconButton, Avatar, CircularProgress } from '@mui/material'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import CloseIcon from '@mui/icons-material/Close'
import SendIcon from '@mui/icons-material/Send'
import { streamAgentChat, type AgentResponse } from '../api/client'
import { useStore } from '../state/store'
import { categorical } from '../theme/palette'
import { useT } from '../i18n/useT'

export default function AgentPanel() {
  const t = useT()
  const mode = useStore((s) => s.mode)
  const locale = useStore((s) => s.locale)
  const agentOpen = useStore((s) => s.agentOpen)
  const setAgentOpen = useStore((s) => s.setAgentOpen)
  const messages = useStore((s) => s.agentMessages)
  const addAgentMessage = useStore((s) => s.addAgentMessage)
  const updateLastAgentMessage = useStore((s) => s.updateLastAgentMessage)
  const clearFilters = useStore((s) => s.clearFilters)
  const setHighlightedDomains = useStore((s) => s.setHighlightedDomains)
  const setHighlightedSubjectIds = useStore((s) => s.setHighlightedSubjectIds)
  const setSelectedDomain = useStore((s) => s.setSelectedDomain)
  const setSelectedSubjectId = useStore((s) => s.setSelectedSubjectId)

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const SUGGESTIONS = [t('agent.suggestion1'), t('agent.suggestion2'), t('agent.suggestion3')]

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
    addAgentMessage({ role: 'agent', text: '', steps: [], pending: true })
    setInput('')
    setSending(true)

    let accumulated = ''
    await streamAgentChat(
      question,
      {
        onStep: (text) => {
          updateLastAgentMessage((m) => ({ ...m, steps: [...(m.steps ?? []), text] }))
        },
        onToken: (text) => {
          accumulated += text
          updateLastAgentMessage((m) => ({ ...m, text: accumulated }))
        },
        onFinal: (evt) => {
          updateLastAgentMessage((m) => ({ ...m, text: evt.reply || accumulated, pending: false }))
          applyDirective(evt.chart_directive)
        },
        onError: () => {
          updateLastAgentMessage((m) => ({ ...m, text: t('agent.queryFailed'), pending: false }))
        },
      },
      locale,
    )
    setSending(false)
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
              {t('agent.title')}
            </Typography>
            <IconButton size="small" onClick={() => setAgentOpen(false)} sx={{ color: '#fff' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Box ref={scrollRef} sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
            {messages.length === 0 && (
              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary">
                  {t('agent.tryAsking')}
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
                    {m.steps && m.steps.length > 0 && (
                      <Stack spacing={0.3} sx={{ mb: m.text ? 0.6 : 0 }}>
                        {m.steps.map((step, si) => (
                          <Typography key={si} variant="caption" color="text.secondary">
                            {step}
                          </Typography>
                        ))}
                      </Stack>
                    )}
                    {m.pending && !m.text ? (
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <CircularProgress size={12} />
                        <Typography variant="caption" color="text.secondary">
                          {t('agent.thinking')}
                        </Typography>
                      </Stack>
                    ) : (
                      <Typography variant="body2">{m.text}</Typography>
                    )}
                  </Paper>
                </Stack>
              ))}
            </Stack>
          </Box>

          <Stack direction="row" spacing={1} sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <TextField
              size="small"
              fullWidth
              placeholder={t('agent.inputPlaceholder')}
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
