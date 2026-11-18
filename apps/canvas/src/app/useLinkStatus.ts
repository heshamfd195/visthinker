import type { Transport, TransportStatus } from "@visthinker/core";
import { useCallback, useSyncExternalStore } from "react";

/** The transport's status, kept up to date. */
export function useLinkStatus(transport: Transport): TransportStatus {
  const subscribe = useCallback((notify: () => void) => transport.onStatus(notify), [transport]);
  return useSyncExternalStore(subscribe, () => transport.status());
}
