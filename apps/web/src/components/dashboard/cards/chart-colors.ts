import type { CSSProperties } from "react";

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

/**
 * Shared Recharts tooltip styling (bar + line cards). itemStyle matters
 * for readability: Recharts colors each entry's text with its series
 * color by default, and the monochrome ramp (--c2…--c5) is 18–65% alpha
 * — near-invisible on the popover in both themes. Pin entries to
 * popover-foreground; the label gets muted-foreground, which clears
 * contrast on --popover in both themes (fg-subtle does not in light).
 */
export const TOOLTIP_CONTENT_STYLE: CSSProperties = {
  fontSize: 12,
  borderRadius: 10,
  background: "var(--popover)",
  border: "1px solid var(--border-strong)",
  color: "var(--popover-foreground)",
  boxShadow: "0 16px 40px -12px rgba(0,0,0,.4)",
};

export const TOOLTIP_ITEM_STYLE: CSSProperties = {
  color: "var(--popover-foreground)",
};

export const TOOLTIP_LABEL_STYLE: CSSProperties = {
  color: "var(--muted-foreground)",
  fontWeight: 600,
};

export const CHART_GRID = "var(--grid)";
export const CHART_TICK = "var(--fg-subtle)";
/** The next/font variable itself — Tailwind's font-mono utility isn't
 *  reachable from Recharts' inline SVG style objects. */
export const CHART_MONO = "var(--font-plex-mono), ui-monospace, monospace";
