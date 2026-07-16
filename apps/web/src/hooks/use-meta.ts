import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { fetchMeta } from "@/lib/api";

export function useMeta() {
  const query = useQuery({
    queryKey: ["meta"],
    queryFn: fetchMeta,
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    if (query.isError) {
      toast.error("Failed to load dashboard metadata — some features may not work.", {
        id: "meta-load-error",
      });
    }
  }, [query.isError]);

  return query;
}
