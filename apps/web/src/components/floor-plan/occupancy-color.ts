/**
 * Occupancy ramp per the take-home spec's floor-plan requirement:
 * <40% low (green), 40–70% mid (yellow), >70% high (red); stale/no-data
 * always gray. (This deliberately overrides the P8 design mock's
 * neutral/green/red legend — the PDF's color mapping wins.) The hues
 * live in globals.css (--occ-*); each band pairs a --occ-*-ink token for
 * labels drawn on top of the fill, because yellow and the dark-theme
 * fills need dark ink where the old ramp took white everywhere.
 */
type OccupancyBand = "low" | "mid" | "high" | "stale";

function occupancyBand(occupancyRatePercent: number, isStale: boolean): OccupancyBand {
  if (isStale) return "stale";
  if (occupancyRatePercent > 70) return "high";
  if (occupancyRatePercent >= 40) return "mid";
  return "low";
}

export function occupancyFill(occupancyRatePercent: number, isStale: boolean): string {
  return `var(--occ-${occupancyBand(occupancyRatePercent, isStale)})`;
}

/** Label color legible on the matching occupancyFill in both themes. */
export function occupancyInk(occupancyRatePercent: number, isStale: boolean): string {
  return `var(--occ-${occupancyBand(occupancyRatePercent, isStale)}-ink)`;
}
