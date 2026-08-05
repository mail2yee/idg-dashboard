import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Card, CardContent, Typography, Box, Stack, LinearProgress, Chip, Button } from '@mui/material'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import StarIcon from '@mui/icons-material/Star'
import BusinessIcon from '@mui/icons-material/Business'
import { api, type DomainTrendSummary, type SubjectTrendSummary, type OwnerTeamTrendSummary } from '../api/client'
import { useStore } from '../state/store'
import { domainColor, DOMAIN_ORDER, categorical, status } from '../theme/palette'
import { getLevelColor } from '../theme/badges'
import InfoTooltip from './InfoTooltip'
import { useT } from '../i18n/useT'

function DomainBadgeCard({
  d,
  mode,
  maxLevel,
  onClick,
}: {
  d: DomainTrendSummary
  mode: 'light' | 'dark'
  maxLevel: number
  onClick: () => void
}) {
  const t = useT()
  const rounded = Math.round(d.avg_maturity_level)
  const toGo = Math.max(0, maxLevel - d.avg_maturity_level)
  return (
    <Card
      variant="outlined"
      onClick={onClick}
      sx={{ width: 182, flexShrink: 0, borderColor: 'divider', cursor: 'pointer' }}
    >
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
          <MilitaryTechIcon sx={{ fontSize: 22, color: getLevelColor(rounded) }} />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              L{rounded}
            </Typography>
            <Stack direction="row" spacing={0.7} sx={{ alignItems: 'center' }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: domainColor(d.domain, mode) }} />
              <Typography variant="subtitle2">{d.domain}</Typography>
            </Stack>
          </Box>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={(d.avg_maturity_level / maxLevel) * 100}
          sx={{
            height: 6,
            borderRadius: 3,
            mt: 1,
            bgcolor: 'action.hover',
            '& .MuiLinearProgress-bar': { bgcolor: categorical[mode][0], borderRadius: 3 },
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {d.avg_maturity_level.toFixed(2)} / L{maxLevel} · {t('leaderboard.toGo', { max: maxLevel })} {toGo.toFixed(2)}
        </Typography>
      </CardContent>
    </Card>
  )
}

function TeamBadgeCard({
  t: team,
  mode,
  maxLevel,
  onClick,
}: {
  t: OwnerTeamTrendSummary
  mode: 'light' | 'dark'
  maxLevel: number
  onClick: () => void
}) {
  const t = useT()
  const rounded = Math.round(team.avg_maturity_level)
  const toGo = Math.max(0, maxLevel - team.avg_maturity_level)
  return (
    <Card variant="outlined" onClick={onClick} sx={{ width: 200, flexShrink: 0, borderColor: 'divider', cursor: 'pointer' }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
          <MilitaryTechIcon sx={{ fontSize: 22, color: getLevelColor(rounded) }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              L{rounded}
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <BusinessIcon sx={{ fontSize: 16, color: 'text.secondary', flexShrink: 0 }} />
              <Typography variant="subtitle2" noWrap title={team.team}>
                {team.team}
              </Typography>
            </Stack>
          </Box>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={(team.avg_maturity_level / maxLevel) * 100}
          sx={{
            height: 6,
            borderRadius: 3,
            mt: 1,
            bgcolor: 'action.hover',
            '& .MuiLinearProgress-bar': { bgcolor: categorical[mode][0], borderRadius: 3 },
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {team.avg_maturity_level.toFixed(2)} / L{maxLevel} · {t('leaderboard.toGo', { max: maxLevel })} {toGo.toFixed(2)} ·{' '}
          {team.subject_count}
          {t('leaderboard.subjectsCount')}
        </Typography>
      </CardContent>
    </Card>
  )
}

function SubjectBadgeCard({
  s,
  mode,
  maxLevel,
  onClick,
}: {
  s: SubjectTrendSummary
  mode: 'light' | 'dark'
  maxLevel: number
  onClick: () => void
}) {
  return (
    <Card
      variant="outlined"
      onClick={onClick}
      sx={{ width: 148, flexShrink: 0, borderColor: 'divider', cursor: 'pointer' }}
    >
      <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
        <Stack direction="row" spacing={0.6} sx={{ alignItems: 'center', mb: 0.4 }}>
          <MilitaryTechIcon sx={{ fontSize: 16, color: getLevelColor(s.maturity_level) }} />
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: domainColor(s.domain, mode), flexShrink: 0 }} />
          <Typography variant="caption" color="text.secondary" noWrap>
            {s.domain}
          </Typography>
        </Stack>
        <Typography variant="body2" noWrap title={s.name} sx={{ fontWeight: 500 }}>
          {s.name}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={(s.maturity_level / maxLevel) * 100}
          sx={{
            height: 5,
            borderRadius: 3,
            mt: 0.6,
            bgcolor: 'action.hover',
            '& .MuiLinearProgress-bar': { bgcolor: categorical[mode][0], borderRadius: 3 },
          }}
        />
        <Typography variant="caption" color="text.secondary">
          L{s.maturity_level} / L{maxLevel}
        </Typography>
      </CardContent>
    </Card>
  )
}

function ChampionCard({
  title,
  name,
  sub,
  delta,
  emptyText,
  onClick,
}: {
  title: string
  name?: string
  sub?: string
  delta?: number
  emptyText: string
  onClick?: () => void
}) {
  return (
    <Card
      variant="outlined"
      onClick={name ? onClick : undefined}
      sx={{
        flex: 1,
        minWidth: 220,
        borderColor: status.good,
        borderWidth: 1.5,
        cursor: name && onClick ? 'pointer' : 'default',
      }}
    >
      <CardContent>
        <Typography variant="caption" color="text.secondary">
          {title}
        </Typography>
        {name ? (
          <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', mt: 0.5 }}>
            <Stack direction="row" spacing={0.8} sx={{ alignItems: 'center' }}>
              <EmojiEventsIcon sx={{ color: status.good, fontSize: 22 }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {name}
                {sub ? ` · ${sub}` : ''}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: status.good, fontWeight: 600 }}>
              +{delta?.toFixed(2)}
            </Typography>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {emptyText}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

function SpotlightRow({
  icon,
  title,
  emptyText,
  items,
}: {
  icon: ReactNode
  title: string
  emptyText: string
  items: { label: string; sub?: string; delta: number }[]
}) {
  return (
    <Box sx={{ mt: 3 }}>
      <Stack direction="row" spacing={0.7} sx={{ alignItems: 'center', mb: 0.5 }}>
        {icon}
        <Typography variant="subtitle2">{title}</Typography>
      </Stack>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {emptyText}
        </Typography>
      ) : (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {items.map((it) => (
            <Chip
              key={it.label + (it.sub ?? '')}
              label={`${it.label}${it.sub ? `(${it.sub})` : ''} +${it.delta.toFixed(2)}`}
              sx={{ bgcolor: 'action.hover', fontWeight: 500 }}
            />
          ))}
        </Stack>
      )}
    </Box>
  )
}

const SUBJECT_WALL_COLLAPSED_COUNT = 12

export default function LeaderboardSection() {
  const t = useT()
  const mode = useStore((s) => s.mode)
  const maxLevel = useStore((s) => s.maxLevel)
  const setSelectedDomainDetail = useStore((s) => s.setSelectedDomainDetail)
  const setSelectedOwnerTeamDetail = useStore((s) => s.setSelectedOwnerTeamDetail)
  const setSelectedSubjectId = useStore((s) => s.setSelectedSubjectId)
  const [domains, setDomains] = useState<DomainTrendSummary[]>([])
  const [subjects, setSubjects] = useState<SubjectTrendSummary[]>([])
  const [teams, setTeams] = useState<OwnerTeamTrendSummary[]>([])
  const [subjectWallExpanded, setSubjectWallExpanded] = useState(false)

  useEffect(() => {
    api.domainsTrendSummary().then((res) => setDomains(res.domains))
    api.subjectsTrendSummary({}).then((res) => setSubjects(res.subjects))
    api.ownerTeamsTrendSummary().then((res) => setTeams(res.teams))
  }, [])

  // alphabetical, not level order — same non-shaming principle as domains
  const orderedTeams = useMemo(() => [...teams].sort((a, b) => a.team.localeCompare(b.team)), [teams])

  const weeklyTeamChampion = [...teams].filter((t) => t.wow_delta > 0).sort((a, b) => b.wow_delta - a.wow_delta)[0]
  const monthlyTeamChampion = [...teams].filter((t) => t.mom_delta > 0).sort((a, b) => b.mom_delta - a.mom_delta)[0]

  // stable, identity-based order — never sorted by level, so no domain reads
  // as "ranked last"; the badge tier alone carries the relative standing
  const orderedDomains = DOMAIN_ORDER.map((name) => domains.find((d) => d.domain === name)).filter(
    (d): d is DomainTrendSummary => Boolean(d),
  )

  // subjects: stable order too — grouped by domain (same fixed order), then
  // alphabetical within domain, so the badge wall doesn't read as a ranking
  const orderedSubjects = useMemo(() => {
    const domainRank = new Map(DOMAIN_ORDER.map((d, i) => [d, i]));
    return [...subjects].sort((a, b) => {
      const rankDiff = (domainRank.get(a.domain) ?? 99) - (domainRank.get(b.domain) ?? 99)
      return rankDiff !== 0 ? rankDiff : a.name.localeCompare(b.name)
    })
  }, [subjects])
  const visibleSubjects = subjectWallExpanded ? orderedSubjects : orderedSubjects.slice(0, SUBJECT_WALL_COLLAPSED_COUNT)

  const weeklyChampion = [...domains].filter((d) => d.wow_delta > 0).sort((a, b) => b.wow_delta - a.wow_delta)[0]
  const monthlyChampion = [...domains].filter((d) => d.mom_delta > 0).sort((a, b) => b.mom_delta - a.mom_delta)[0]

  const topWeeklyDomains = [...domains]
    .filter((d) => d.wow_delta > 0)
    .sort((a, b) => b.wow_delta - a.wow_delta)
    .slice(0, 3)
    .map((d) => ({ label: d.domain, delta: d.wow_delta }))

  const topMonthlyDomains = [...domains]
    .filter((d) => d.mom_delta > 0)
    .sort((a, b) => b.mom_delta - a.mom_delta)
    .slice(0, 3)
    .map((d) => ({ label: d.domain, delta: d.mom_delta }))

  const topWeeklySubjects = [...subjects]
    .filter((s) => s.wow_delta > 0)
    .sort((a, b) => b.wow_delta - a.wow_delta)
    .slice(0, 3)
    .map((s) => ({ label: s.name, sub: s.domain, delta: s.wow_delta }))

  const topMonthlySubjects = [...subjects]
    .filter((s) => s.mom_delta > 0)
    .sort((a, b) => b.mom_delta - a.mom_delta)
    .slice(0, 3)
    .map((s) => ({ label: s.name, sub: s.domain, delta: s.mom_delta }))

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
          <EmojiEventsIcon sx={{ fontSize: 20 }} />
          <Typography variant="subtitle1">{t('leaderboard.title')}</Typography>
          <InfoTooltip text={t('leaderboard.tooltip')} />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('leaderboard.goalLine', { max: maxLevel })}
        </Typography>

        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <ChampionCard
            title={t('leaderboard.weeklyDomainChampion')}
            name={weeklyChampion?.domain}
            delta={weeklyChampion?.wow_delta}
            emptyText={t('leaderboard.emptyFlatWeek')}
            onClick={() => weeklyChampion && setSelectedDomainDetail(weeklyChampion.domain)}
          />
          <ChampionCard
            title={t('leaderboard.monthlyDomainChampion')}
            name={monthlyChampion?.domain}
            delta={monthlyChampion?.mom_delta}
            emptyText={t('leaderboard.emptyFlatMonth')}
            onClick={() => monthlyChampion && setSelectedDomainDetail(monthlyChampion.domain)}
          />
        </Stack>

        <Typography variant="subtitle2" gutterBottom>
          {t('leaderboard.domainBadges')}
        </Typography>
        <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap', mb: 1 }}>
          {orderedDomains.map((d) => (
            <DomainBadgeCard key={d.domain} d={d} mode={mode} maxLevel={maxLevel} onClick={() => setSelectedDomainDetail(d.domain)} />
          ))}
        </Stack>

        <Stack direction="row" spacing={2} sx={{ mb: 2, mt: 1 }}>
          <ChampionCard
            title={t('leaderboard.weeklyTeamChampion')}
            name={weeklyTeamChampion?.team}
            delta={weeklyTeamChampion?.wow_delta}
            emptyText={t('leaderboard.emptyFlatWeekTeam')}
            onClick={() => weeklyTeamChampion && setSelectedOwnerTeamDetail(weeklyTeamChampion.team)}
          />
          <ChampionCard
            title={t('leaderboard.monthlyTeamChampion')}
            name={monthlyTeamChampion?.team}
            delta={monthlyTeamChampion?.mom_delta}
            emptyText={t('leaderboard.emptyFlatMonthTeam')}
            onClick={() => monthlyTeamChampion && setSelectedOwnerTeamDetail(monthlyTeamChampion.team)}
          />
        </Stack>

        <Typography variant="subtitle2" gutterBottom>
          {t('leaderboard.teamBadges')}
        </Typography>
        <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap', mb: 1 }}>
          {orderedTeams.map((team) => (
            <TeamBadgeCard key={team.team} t={team} mode={mode} maxLevel={maxLevel} onClick={() => setSelectedOwnerTeamDetail(team.team)} />
          ))}
        </Stack>

        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
          <Typography variant="subtitle2">{t('leaderboard.subjectWall', { n: orderedSubjects.length })}</Typography>
          {orderedSubjects.length > SUBJECT_WALL_COLLAPSED_COUNT && (
            <Button size="small" onClick={() => setSubjectWallExpanded((v) => !v)}>
              {subjectWallExpanded ? t('leaderboard.collapse') : t('leaderboard.showAll')}
            </Button>
          )}
        </Stack>
        <Stack direction="row" spacing={1.25} useFlexGap sx={{ flexWrap: 'wrap', mb: 1 }}>
          {visibleSubjects.map((s) => (
            <SubjectBadgeCard key={s.id} s={s} mode={mode} maxLevel={maxLevel} onClick={() => setSelectedSubjectId(s.id)} />
          ))}
        </Stack>

        <SpotlightRow
          icon={<RocketLaunchIcon sx={{ fontSize: 18, color: categorical[mode][0] }} />}
          title={t('leaderboard.top3WeeklyDomain')}
          emptyText={t('leaderboard.emptyFlatWeek')}
          items={topWeeklyDomains}
        />
        <SpotlightRow
          icon={<TrendingUpIcon sx={{ fontSize: 18, color: categorical[mode][0] }} />}
          title={t('leaderboard.top3MonthlyDomain')}
          emptyText={t('leaderboard.emptyFlatMonth')}
          items={topMonthlyDomains}
        />
        <SpotlightRow
          icon={<StarIcon sx={{ fontSize: 18, color: categorical[mode][0] }} />}
          title={t('leaderboard.top3WeeklySubject')}
          emptyText={t('leaderboard.emptyFlatWeekSubject')}
          items={topWeeklySubjects}
        />
        <SpotlightRow
          icon={<MilitaryTechIcon sx={{ fontSize: 18, color: categorical[mode][0] }} />}
          title={t('leaderboard.top3MonthlySubject')}
          emptyText={t('leaderboard.emptyFlatMonthSubject')}
          items={topMonthlySubjects}
        />
      </CardContent>
    </Card>
  )
}
