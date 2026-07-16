import { useQuery } from "@tanstack/react-query";
import { fetchOccupancyLatest } from "@/lib/api";

export function useOccupancyLatest(buildingId: string, floor: number) {
  return useQuery({
    queryKey: ["occupancy-latest", buildingId, floor],
    queryFn: () => fetchOccupancyLatest(buildingId, floor),
    refetchInterval: 30_000,
  });
}
