export interface OrgSnapshot {
  id: string
  scope_type: 'GLOBAL' | 'DOMAIN'
  scope_id: string | null
  domain: string | null
  snapshot_date: string
  avg_maturity_score: number
  subject_count: number
  data_quality_index: number
  wow_delta: number
  mom_delta: number
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
  maturity_score: number | null
  sub_scores: Record<string, number> | null
}

export interface MaturitySnapshot {
  id: string
  subject_id: string
  snapshot_date: string
  maturity_score: number
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

export interface DomainTrendSummary {
  domain: string
  avg_maturity_score: number
  wow_delta: number
  mom_delta: number
  series: number[]
}

export interface SubjectTrendSummary {
  id: string
  name: string
  domain: string
  maturity_score: number
  wow_delta: number
  mom_delta: number
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

export interface DomainDetail {
  domain: string
  avg_maturity_score: number
  wow_delta: number
  mom_delta: number
  series: { date: string; score: number }[]
  avg_sub_scores: Record<string, number>
  subjects: { id: string; name: string; maturity_score: number; wow_delta: number }[]
}

export interface DimensionMeta {
  key: string
  label: string
  weight: number
  responsible_role: string | null
}

export interface OwnerTeamTrendSummary {
  team: string
  avg_maturity_score: number
  wow_delta: number
  mom_delta: number
  series: number[]
  subject_count: number
}

export interface OwnerTeamDetail {
  team: string
  avg_maturity_score: number
  wow_delta: number
  mom_delta: number
  series: { date: string; score: number }[]
  avg_sub_scores: Record<string, number>
  subjects: { id: string; name: string; domain: string; maturity_score: number; wow_delta: number }[]
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
    get<{ buckets: { range: string; count: number }[]; max_score: number }>('/maturity/distribution'),
  configDimensions: () => get<{ dimensions: DimensionMeta[]; max_score: number }>('/config/dimensions'),
  domainRanking: () => get<{ domains: OrgSnapshot[] }>('/domains/ranking'),
  domainsTrendSummary: () => get<{ domains: DomainTrendSummary[] }>('/domains/trend-summary'),
  domainDetail: (domain: string) => get<DomainDetail>(`/domains/${encodeURIComponent(domain)}/detail`),
  domainsDimensionBreakdown: () => get<{ domains: DomainDimensionBreakdown[] }>('/domains/dimension-breakdown'),
  ownerTeamsTrendSummary: () => get<{ teams: OwnerTeamTrendSummary[] }>('/owner-teams/trend-summary'),
  ownerTeamDetail: (team: string) => get<OwnerTeamDetail>(`/owner-teams/${encodeURIComponent(team)}/detail`),
  subjectsTrendSummary: (params: { domain?: string; search?: string }) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v) qs.set(k, v)
    })
    const q = qs.toString()
    return get<{ subjects: SubjectTrendSummary[] }>(`/subjects/trend-summary${q ? `?${q}` : ''}`)
  },
  subjects: (params: { domain?: string; min_score?: number; max_score?: number; search?: string }) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
    })
    const q = qs.toString()
    return get<{ subjects: Subject[] }>(`/subjects${q ? `?${q}` : ''}`)
  },
  subjectDetail: (id: string) => get<SubjectDetail>(`/subjects/${id}`),
  subjectTrend: (id: string) => get<{ trend: MaturitySnapshot[] }>(`/subjects/${id}/trend`),
  agentQuery: (question: string) => post<AgentResponse>('/agent/query', { question }),
}
