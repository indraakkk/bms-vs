import { STATUS } from "@/components/dashboard/cards/chart-colors";

const STALE_FILL = "#d4d4d4";

/** <40% green, 40–70% yellow, >70% red — thresholds defined once, reused everywhere. */
export function occupancyFill(occupancyRatePercent: number, isStale: boolean): string {
  if (isStale) return STALE_FILL;
  if (occupancyRatePercent > 70) return STATUS.critical;
  if (occupancyRatePercent >= 40) return STATUS.warning;
  return STATUS.good;
}
