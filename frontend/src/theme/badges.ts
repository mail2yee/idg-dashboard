// Maturity Level (L0-L5) is itself the achievement tier now — there's no
// separate Bronze/Silver/Gold layer on top of it. Every level still gets a
// distinct color so the badge grid reads at a glance, framed as "how far up
// the ladder", not a verdict — L0 is muted, not red/failing.
//
// Rendered as an MUI icon (MilitaryTechIcon) tinted by this color, not an
// emoji character — emoji glyphs depend on the OS/browser having a
// color-emoji font installed, which locked-down corporate images often
// strip out, rendering as a blank box. An MUI icon is real SVG bundled into
// the JS at build time, so it renders identically everywhere with zero
// font/network dependency.
const LEVEL_COLOR_RAMP = [
  '#9aa1a8', // L0 — hasn't reached L1 yet
  '#b08d57', // L1
  '#8ec5e8', // L2
  '#6b9bc9', // L3
  '#5fa88a', // L4
  '#d4af37', // L5 — every KPI satisfied
]

export function getLevelColor(level: number): string {
  const idx = Math.max(0, Math.min(level, LEVEL_COLOR_RAMP.length - 1))
  return LEVEL_COLOR_RAMP[idx]
}
