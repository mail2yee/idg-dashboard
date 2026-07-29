import { create } from 'zustand'
import type { Mode } from '../theme/palette'
import type { DimensionMeta } from '../api/client'

interface ChatMessage {
  role: 'user' | 'agent'
  text: string
}

interface DashboardState {
  mode: Mode
  toggleMode: () => void

  // maturity dimension config — fetched once at startup from
  // /api/config/dimensions, which reads config/maturity_dimensions.json on
  // the backend. Components read from here instead of hardcoding the 5
  // dimension keys, so adding a dimension in that config file needs no
  // frontend code change either.
  dimensions: DimensionMeta[]
  maxScore: number
  setDimensionConfig: (dimensions: DimensionMeta[], maxScore: number) => void

  // cross-filter state, driven by chart clicks and by the AI agent
  selectedDomain: string | null
  scoreRange: [number, number] | null
  highlightedDomains: string[]
  highlightedSubjectIds: string[]
  search: string

  setSelectedDomain: (d: string | null) => void
  setScoreRange: (r: [number, number] | null) => void
  setHighlightedDomains: (d: string[]) => void
  setHighlightedSubjectIds: (ids: string[]) => void
  setSearch: (s: string) => void
  clearFilters: () => void

  selectedSubjectId: string | null
  setSelectedSubjectId: (id: string | null) => void

  selectedDomainDetail: string | null
  setSelectedDomainDetail: (domain: string | null) => void

  selectedOwnerTeamDetail: string | null
  setSelectedOwnerTeamDetail: (team: string | null) => void

  agentOpen: boolean
  setAgentOpen: (open: boolean) => void
  agentMessages: ChatMessage[]
  addAgentMessage: (m: ChatMessage) => void
}

const prefersDark =
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches

export const useStore = create<DashboardState>((set) => ({
  mode: prefersDark ? 'dark' : 'light',
  toggleMode: () => set((s) => ({ mode: s.mode === 'light' ? 'dark' : 'light' })),

  dimensions: [],
  maxScore: 5,
  setDimensionConfig: (dimensions, maxScore) => set({ dimensions, maxScore }),

  selectedDomain: null,
  scoreRange: null,
  highlightedDomains: [],
  highlightedSubjectIds: [],
  search: '',

  setSelectedDomain: (d) => set((s) => ({ selectedDomain: s.selectedDomain === d ? null : d })),
  setScoreRange: (r) => set({ scoreRange: r }),
  setHighlightedDomains: (d) => set({ highlightedDomains: d }),
  setHighlightedSubjectIds: (ids) => set({ highlightedSubjectIds: ids }),
  setSearch: (s) => set({ search: s }),
  clearFilters: () =>
    set({ selectedDomain: null, scoreRange: null, highlightedDomains: [], highlightedSubjectIds: [], search: '' }),

  selectedSubjectId: null,
  setSelectedSubjectId: (id) => set({ selectedSubjectId: id }),

  selectedDomainDetail: null,
  setSelectedDomainDetail: (domain) => set({ selectedDomainDetail: domain }),

  selectedOwnerTeamDetail: null,
  setSelectedOwnerTeamDetail: (team) => set({ selectedOwnerTeamDetail: team }),

  agentOpen: false,
  setAgentOpen: (open) => set({ agentOpen: open }),
  agentMessages: [],
  addAgentMessage: (m) => set((s) => ({ agentMessages: [...s.agentMessages, m] })),
}))
