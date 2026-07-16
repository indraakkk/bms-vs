/**
 * Chart colors are theme tokens from the design mock (see globals.css):
 * a monochrome series ramp (--c1…--c5, primary at descending opacity)
 * plus reserved status colors. Everything is a CSS var so charts follow
 * the dark/light toggle without re-rendering.
 */
export const SERIES_COLORS = [
  "var(--c1)",
  "var(--c2)",
  "var(--c3)",
  "var(--c4)",
  "var(--c5)",
] as const;

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

export const CHART_GRID = "var(--grid)";
export const CHART_TICK = "var(--fg-subtle)";
/** The next/font variable itself — Tailwind's font-mono utility isn't
 *  reachable from Recharts' inline SVG style objects. */
export const CHART_MONO = "var(--font-plex-mono), ui-monospace, monospace";
