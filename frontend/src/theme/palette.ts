// Validated default palette from the dataviz skill (references/palette.md).
// Categorical hues are assigned in this fixed order — never cycled/reassigned
// by rank — so an entity keeps its color no matter how a filter reorders it.

export const categorical = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
}

export const sequentialBlue = {
  light: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'],
  dark: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'],
}

export const status = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
}

export const chrome = {
  light: {
    surface: '#fcfcfb',
    page: '#f9f9f7',
    textPrimary: '#0b0b0b',
    textSecondary: '#52514e',
    textMuted: '#898781',
    gridline: '#e1e0d9',
    baseline: '#c3c2b7',
    successText: '#006300',
    border: 'rgba(11,11,11,0.10)',
  },
  dark: {
    surface: '#1a1a19',
    page: '#0d0d0d',
    textPrimary: '#ffffff',
    textSecondary: '#c3c2b7',
    textMuted: '#898781',
    gridline: '#2c2c2a',
    baseline: '#383835',
    successText: '#0ca30c',
    border: 'rgba(255,255,255,0.10)',
  },
}

export type Mode = 'light' | 'dark'

// Fixed domain -> categorical slot assignment so a domain keeps its color
// across every chart and every filter state (color follows the entity).
export const DOMAIN_ORDER = ['Finance', 'Sales', 'Platform', 'Marketing', 'Product', 'Risk']

export function domainColor(domain: string, mode: Mode): string {
  const idx = DOMAIN_ORDER.indexOf(domain)
  const palette = categorical[mode]
  return palette[idx >= 0 ? idx % palette.length : palette.length - 1]
}
