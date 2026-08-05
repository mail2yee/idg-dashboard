import { useCallback } from 'react'
import { useStore } from '../state/store'
import { en, zh, type TKey } from './strings'

const dicts = { en, zh }

// Simple {name}-style interpolation for the handful of strings that need a
// dynamic value embedded mid-sentence (e.g. "reach L{max}") -- most
// dynamic values (numbers, domain names) are just concatenated around a
// plain t() fragment in the component instead, this is only for the cases
// where that would read awkwardly.
//
// Memoized on `locale` (via useCallback) rather than returning a fresh
// closure every render -- callers that put `t` in a useMemo/useEffect dep
// array (to correctly recompute translated content when the language
// changes) would otherwise recompute on every render regardless of
// whether the locale actually changed.
export function useT() {
  const locale = useStore((s) => s.locale)
  return useCallback(
    (key: TKey, params?: Record<string, string | number>) => {
      const str = dicts[locale][key]
      if (!params) return str
      return str.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match))
    },
    [locale],
  )
}
