import { useEffect, useState } from "react";

import {
  offlineService,
  type OfflineQueueSnapshot,
  type OfflineService,
} from "@/lib/offline";

export function useOfflineStatus(service: OfflineService = offlineService): Readonly<OfflineQueueSnapshot> {
  const [snapshot, setSnapshot] = useState<Readonly<OfflineQueueSnapshot>>(() => service.getSnapshot());

  useEffect(() => {
    setSnapshot(service.getSnapshot());
    return service.subscribe(() => setSnapshot(service.getSnapshot()));
  }, [service]);

  return snapshot;
}
