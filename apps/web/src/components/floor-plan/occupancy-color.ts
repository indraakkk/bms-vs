/**
 * Occupancy ramp from the design mock's tokens: <40% low (neutral),
 * 40–70% mid (green), >70% high (red); stale/no-data always gray. The
 * thresholds are the spec's; the *hues* live in globals.css (--occ-*),
 * so restoring the plan's original green/amber/red is a token swap, not
 * a code change.
 */
export function occupancyFill(occupancyRatePercent: number, isStale: boolean): string {
  if (isStale) return "var(--occ-stale)";
  if (occupancyRatePercent > 70) return "var(--occ-high)";
  if (occupancyRatePercent >= 40) return "var(--occ-mid)";
  return "var(--occ-low)";
}
