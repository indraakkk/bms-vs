import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * False during SSR/hydration, true after — via useSyncExternalStore's
 * server snapshot, the recommended no-effect way to gate UI derived from
 * the localStorage-persisted dashboard store, which the server can't
 * know (rendering it during SSR would guarantee a hydration mismatch).
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
