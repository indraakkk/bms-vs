"use client";

import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useMeta } from "@/hooks/use-meta";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useFilterStore } from "@/stores/filter-store";

const ALL = "__all__";

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "last7d", label: "Last 7 days" },
  { value: "all", label: "All data" },
] as const;

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

  const customRange: DateRange | undefined =
    filters.timeRange.preset === "custom"
      ? {
          from: filters.timeRange.from
            ? utcIsoToLocalCalendarDate(filters.timeRange.from)
            : undefined,
          to: filters.timeRange.to ? utcIsoToLocalCalendarDate(filters.timeRange.to) : undefined,
        }
      : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
      <Select
        value={filters.buildingId ?? ALL}
        onValueChange={(v) =>
          setFilters({ ...filters, buildingId: v === ALL ? undefined : v })
        }
      >
        <SelectTrigger className="w-[160px]">
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
        <SelectTrigger className="w-[130px]">
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

      <div className="mx-1 h-6 w-px bg-border" />

      <div className="flex gap-1">
        {PRESETS.map((preset) => (
          <Button
            key={preset.value}
            size="sm"
            variant={filters.timeRange.preset === preset.value ? "default" : "outline"}
            onClick={() => setFilters({ ...filters, timeRange: { preset: preset.value } })}
          >
            {preset.label}
          </Button>
        ))}

        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant={filters.timeRange.preset === "custom" ? "default" : "outline"}
              className={cn("gap-1.5")}
            >
              <CalendarIcon className="size-3.5" />
              {filters.timeRange.preset === "custom" && customRange?.from
                ? customRange.to
                  ? `${format(customRange.from, "MMM d")} – ${format(customRange.to, "MMM d")}`
                  : format(customRange.from, "MMM d")
                : "Custom"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
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
    </div>
  );
}
