"use client";

import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { IconFunnel } from "@/components/icons";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMeta } from "@/hooks/use-meta";
import { cn } from "@/lib/utils";
import { useFilterStore } from "@/stores/filter-store";

const ALL = "__all__";

/** Design order: All data · Today · 7 days · Custom (custom is the popover). */
const PRESETS = [
  { value: "all", label: "All data" },
  { value: "today", label: "Today" },
  { value: "last7d", label: "7 days" },
] as const;

/** Compact trigger matching the mock's surface-3 pill selects. */
const SELECT_TRIGGER_CLASS =
  "h-auto rounded-lg border-border bg-surface-3 px-3 py-[7px] font-semibold text-[12.5px] shadow-none dark:bg-surface-3 dark:hover:bg-surface-3";

/**
 * The seed data is UTC-labeled calendar timestamps (see server/clock.ts),
 * so a custom-range pick of "June 1" must query UTC June 1 00:00–23:59:59
 * regardless of the browser's own timezone — otherwise a non-UTC user's
 * selection silently shifts by their UTC offset and returns the wrong
 * (or no) data. `date`'s *local* Y/M/D — whatever calendar day the user
 * actually clicked — is reinterpreted as a UTC calendar day.
 */
function utcDayBounds(date: Date): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())),
    end: new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)),
  };
}

/** Inverse of utcDayBounds, for redisplaying a stored UTC bound as the
 *  right calendar cell — a local Date carrying the UTC value's Y/M/D. */
function utcIsoToLocalCalendarDate(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function FilterBar() {
  const { data: meta } = useMeta();
  const filters = useFilterStore((s) => s.filters);
  const setFilters = useFilterStore((s) => s.setFilters);

  const customActive = filters.timeRange.preset === "custom";
  const customRange: DateRange | undefined = customActive
    ? {
        from: filters.timeRange.from
          ? utcIsoToLocalCalendarDate(filters.timeRange.from)
          : undefined,
        to: filters.timeRange.to ? utcIsoToLocalCalendarDate(filters.timeRange.to) : undefined,
      }
    : undefined;

  const customLabel =
    customActive && customRange?.from
      ? customRange.to
        ? `${format(customRange.from, "MMM d")} – ${format(customRange.to, "MMM d")}`
        : format(customRange.from, "MMM d")
      : "Custom";

  return (
    <div className="flex flex-wrap items-center gap-3 border-b bg-card px-[22px] py-[11px]">
      <div className="flex items-center gap-[7px] font-semibold text-[12px] text-fg-subtle">
        <IconFunnel size={15} />
        Filters
      </div>

      <Select
        value={filters.buildingId ?? ALL}
        onValueChange={(v) => setFilters({ ...filters, buildingId: v === ALL ? undefined : v })}
      >
        <SelectTrigger className={SELECT_TRIGGER_CLASS}>
          <SelectValue placeholder="Building" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All buildings</SelectItem>
          {meta?.buildings.map((b) => (
            <SelectItem key={b} value={b}>
              {b}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.floor !== undefined ? String(filters.floor) : ALL}
        onValueChange={(v) =>
          setFilters({ ...filters, floor: v === ALL ? undefined : Number(v) })
        }
      >
        <SelectTrigger className={SELECT_TRIGGER_CLASS}>
          <SelectValue placeholder="Floor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All floors</SelectItem>
          {meta?.floors.map((f) => (
            <SelectItem key={f} value={String(f)}>
              Floor {f}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex gap-0.5 rounded-[9px] border bg-surface-3 p-[3px]">
        {PRESETS.map((preset) => (
          <SegmentButton
            key={preset.value}
            active={filters.timeRange.preset === preset.value}
            onClick={() => setFilters({ ...filters, timeRange: { preset: preset.value } })}
          >
            {preset.label}
          </SegmentButton>
        ))}

        <Popover>
          <PopoverTrigger asChild>
            <SegmentButton active={customActive}>{customLabel}</SegmentButton>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              // Open on the seeded month (the "seed · 2025-06-01" chip on
              // the right) instead of 13 months of back-paging from today.
              defaultMonth={customRange?.from ?? new Date(2025, 5)}
              selected={customRange}
              onSelect={(range) => {
                if (range?.from) {
                  const from = utcDayBounds(range.from).start;
                  const to = utcDayBounds(range.to ?? range.from).end;
                  setFilters({
                    ...filters,
                    timeRange: {
                      preset: "custom",
                      from: from.toISOString(),
                      to: to.toISOString(),
                    },
                  });
                }
              }}
              numberOfMonths={1}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex-1" />
      {/* The committed dataset is a single seeded day — surfaced here, as
          in the mock, so an empty "Today" reads as honest, not broken. */}
      <div className="font-mono text-[11.5px] text-fg-subtle">seed · 2025-06-01</div>
    </div>
  );
}

function SegmentButton({
  active,
  onClick,
  children,
  ...props
}: React.ComponentProps<"button"> & { active: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[7px] px-[11px] py-1.5 font-semibold text-[12px] transition-[color,background-color,scale] active:scale-[0.97]",
        active
          ? "bg-card text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
          : "text-muted-foreground hover:text-foreground",
      )}
      {...props}
    >
      {children}
    </button>
  );
}
