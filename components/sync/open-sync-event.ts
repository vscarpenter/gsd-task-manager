import { useEffect, useState } from "react";

/** Window event that opens the sync sign-in dialog owned by SyncButton. */
export const OPEN_SYNC_EVENT = "gsd:open-sync";

/** Open/closed state for the sign-in dialog; also opens on OPEN_SYNC_EVENT. */
export function useSyncDialogState() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_SYNC_EVENT, show);
    return () => window.removeEventListener(OPEN_SYNC_EVENT, show);
  }, []);

  return [open, setOpen] as const;
}
