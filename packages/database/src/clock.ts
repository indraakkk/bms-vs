/**
 * The seed CSVs cover a single day (2025-06-01, hourly, last reading
 * 22:00/22:30) — real "today"/"last 7 days" filters are empty against
 * the actual wall clock. Setting DEMO_NOW pins what "now" means for
 * time-range presets and occupancy staleness so the dashboard can be
 * demoed populated (or deliberately stale) on demand; unset means real
 * time, and the resulting empty/stale states are honest, not a bug.
 */
export function now(): Date {
  const demoNow = process.env.DEMO_NOW;
  if (demoNow) {
    const parsed = new Date(demoNow);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}
