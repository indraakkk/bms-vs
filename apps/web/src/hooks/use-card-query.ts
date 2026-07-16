import type { CardConfig } from "@bms/contract";
import { useQuery } from "@tanstack/react-query";
import { postQuery } from "@/lib/api";
import { useFilterStore } from "@/stores/filter-store";

/**
 * Keyed on [cardId, config, globalFilters] per the spec — a global filter
 * change invalidates every card's key simultaneously, refetching them all.
 */
export function useCardQuery(cardId: string, config: CardConfig | null) {
  const filters = useFilterStore((s) => s.filters);

  return useQuery({
    queryKey: ["card-query", cardId, config, filters],
    queryFn: () => postQuery(config!, filters),
    enabled: config !== null,
  });
}
