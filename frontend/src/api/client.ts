export type Period = 'week' | 'month' | 'year'

export interface OrgSnapshot {
  id: string
  scope_type: 'GLOBAL' | 'DOMAIN'
  scope_id: string | null
  domain: string | null
  snapshot_date: string
  avg_maturity_level: number
  subject_count: number
  data_quality_index: number
  wow_delta: number
  mom_delta: number
  yoy_delta: number
}

export interface Subject {
  id: string
  datahub_urn: string
  name: string
  type: string
  domain: string
  domain_urn: string
  platform: string
  owners: { urn: string; name: string; email: string; role: string; team: string }[]
  description: string
  tags: string[]
  glossary_terms: string[]
  is_deprecated: boolean
  status: string
  created_at: string
  last_synced_at: string
  maturity_level: number | null
  sub_scores: Record<string, number> | null
}

export interface MaturitySnapshot {
  id: string
  subject_id: string
  snapshot_date: string
  maturity_level: number
  sub_scores: Record<string, number>
  kpis: Record<string, unknown>
}

export interface SubjectDetail {
  subject: Subject
  snapshot: MaturitySnapshot | null
  assertions: Record<string, unknown>[]
  incidents: Record<string, unknown>[]
  lineage: Record<string, unknown>[]
  pipeline: Record<string, unknown> | null
  schema_fields: Record<string, unknown>[]
}

interface PeriodDeltas {
  wow_delta: number
  mom_delta: number
  yoy_delta: number
  delta: number
}

export interface DomainTrendSummary extends PeriodDeltas {
  domain: string
  avg_maturity_level: number
  series: number[]
}

export interface SubjectTrendSummary extends PeriodDeltas {
  id: string
  name: string
  domain: string
  maturity_level: number
  series: number[]
}

export interface DomainDimensionBreakdown {
  domain: string
  api: number
  metadata: number
  lineage: number
  alerting: number
  freshness: number
}

export interface DomainDetail extends PeriodDeltas {
  domain: string
  avg_maturity_level: number
  series: { date: string; level: number }[]
  avg_sub_scores: Record<string, number>
  subjects: { id: string; name: string; maturity_level: number; wow_delta: number }[]
}

export interface DimensionMeta {
  key: string
  label: string
  weight: number
  responsible_role: string | null
}

export interface LevelMeta {
  level: number
  label: string
  description: string | null
}

export interface OwnerTeamTrendSummary extends PeriodDeltas {
  team: string
  avg_maturity_level: number
  series: number[]
  subject_count: number
}

export interface OwnerTeamDetail extends PeriodDeltas {
  team: string
  avg_maturity_level: number
  series: { date: string; level: number }[]
  avg_sub_scores: Record<string, number>
  subjects: { id: string; name: string; domain: string; maturity_level: number; wow_delta: number }[]
}

export interface LevelDistribution {
  dates: string[]
  series: Record<string, number[]>
  min_level: number
  max_level: number
}

export interface AgentResponse {
  answer_text: string
  chart_directive: { type: string; [key: string]: unknown } | null
  data: unknown
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`)
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`)
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`)
  return res.json()
}

export const api = {
  maturitySummary: () => get<{ latest: OrgSnapshot; trend: OrgSnapshot[] }>('/maturity/summary'),
  maturityDistribution: () =>
    get<{ levels: { level: number; count: number }[]; max_level: number }>('/maturity/distribution'),
  configDimensions: () => get<{ dimensions: DimensionMeta[]; max_score: number }>('/config/dimensions'),
  configLevels: () => get<{ levels: LevelMeta[]; max_level: number }>('/config/levels'),
  domainRanking: () => get<{ domains: OrgSnapshot[] }>('/domains/ranking'),
  domainsTrendSummary: (period: Period = 'week') =>
    get<{ domains: DomainTrendSummary[] }>(`/domains/trend-summary?period=${period}`),
  domainDetail: (domain: string, period: Period = 'week') =>
    get<DomainDetail>(`/domains/${encodeURIComponent(domain)}/detail?period=${period}`),
  domainsDimensionBreakdown: () => get<{ domains: DomainDimensionBreakdown[] }>('/domains/dimension-breakdown'),
  domainsLevelDistribution: (period: Period = 'week') =>
    get<LevelDistribution>(`/domains/level-distribution?period=${period}`),
  ownerTeamsTrendSummary: (period: Period = 'week') =>
    get<{ teams: OwnerTeamTrendSummary[] }>(`/owner-teams/trend-summary?period=${period}`),
  ownerTeamDetail: (team: string, period: Period = 'week') =>
    get<OwnerTeamDetail>(`/owner-teams/${encodeURIComponent(team)}/detail?period=${period}`),
  subjectsTrendSummary: (params: { domain?: string; search?: string; period?: Period }) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v) qs.set(k, v)
    })
    const q = qs.toString()
    return get<{ subjects: SubjectTrendSummary[] }>(`/subjects/trend-summary${q ? `?${q}` : ''}`)
  },
  subjectsLevelDistribution: (params: { domain?: string; search?: string; period?: Period }) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v) qs.set(k, v)
    })
    const q = qs.toString()
    return get<LevelDistribution>(`/subjects/level-distribution${q ? `?${q}` : ''}`)
  },
  subjects: (params: { domain?: string; min_level?: number; max_level?: number; search?: string }) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
    })
    const q = qs.toString()
    return get<{ subjects: Subject[] }>(`/subjects${q ? `?${q}` : ''}`)
  },
  subjectDetail: (id: string) => get<SubjectDetail>(`/subjects/${id}`),
  subjectTrend: (id: string, period: Period = 'week') =>
    get<{ trend: MaturitySnapshot[] }>(`/subjects/${id}/trend?period=${period}`),
  agentQuery: (question: string) => post<AgentResponse>('/agent/query', { question }),
}
