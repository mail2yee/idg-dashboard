// Tiers frame every score as an achievement, not a verdict — even the lowest
// band gets a named badge, never a bare/red "fail" state. Kept separate from
// the categorical domain colors so a tier never impersonates identity color.
export interface Tier {
  label: string
  icon: string
}

// Thresholds are fractions of maxScore, not absolute points — so tiers stay
// meaningful if config/maturity_dimensions.json ever changes the total.
export function getTier(score: number, maxScore = 5): Tier {
  const ratio = score / maxScore
  if (ratio >= 0.9) return { label: 'Platinum', icon: '🏅' }
  if (ratio >= 0.7) return { label: 'Gold', icon: '🥇' }
  if (ratio >= 0.5) return { label: 'Silver', icon: '🥈' }
  return { label: 'Bronze', icon: '🥉' }
}
