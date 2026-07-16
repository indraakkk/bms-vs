import type { GlobalFilters } from "@bms/contract";
import { create } from "zustand";

/**
 * Deliberately ephemeral (no persist middleware) — unlike the dashboard
 * layout, global filters reset on refresh rather than trapping a user in
 * a stale building/floor/time-range selection.
 */
export const useFilterStore = create<{
  filters: GlobalFilters;
  setFilters: (filters: GlobalFilters) => void;
}>((set) => ({
  filters: { timeRange: { preset: "all" } },
  setFilters: (filters) => set({ filters }),
}));
