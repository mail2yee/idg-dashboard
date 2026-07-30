// Tiers frame every score as an achievement, not a verdict — even the lowest
// band gets a named badge, never a bare/red "fail" state. Kept separate from
// the categorical domain colors so a tier never impersonates identity color.
//
// Rendered as an MUI icon (MilitaryTechIcon) tinted by `color`, not an emoji
// character — emoji glyphs depend on the OS/browser having a color-emoji
// font installed, which locked-down corporate images often strip out,
// rendering as a blank box. An MUI icon is real SVG bundled into the JS at
// build time, so it renders identically everywhere with zero font/network
// dependency.
export interface Tier {
  label: string
  color: string
}

const TIER_COLORS = {
  Platinum: '#8ec5e8',
  Gold: '#d4af37',
  Silver: '#9aa1a8',
  Bronze: '#b08d57',
}

// Thresholds are fractions of maxScore, not absolute points — so tiers stay
// meaningful if config/maturity_dimensions.json ever changes the total.
export function getTier(score: number, maxScore = 5): Tier {
  const ratio = score / maxScore
  if (ratio >= 0.9) return { label: 'Platinum', color: TIER_COLORS.Platinum }
  if (ratio >= 0.7) return { label: 'Gold', color: TIER_COLORS.Gold }
  if (ratio >= 0.5) return { label: 'Silver', color: TIER_COLORS.Silver }
  return { label: 'Bronze', color: TIER_COLORS.Bronze }
}
