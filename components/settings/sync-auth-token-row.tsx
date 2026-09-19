"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getPocketBase } from "@/lib/sync/pocketbase-client";
import { SettingsRow } from "./shared-components";

async function copyAuthToken(): Promise<void> {
  // Read at click time: refresh, expiry or sign-out may follow the last render.
  const currentStore = getPocketBase().authStore;
  if (!currentStore.token || !currentStore.isValid) {
    toast.error("Sign in again to copy your token.");
    return;
  }

  try {
    // Keep this within the user gesture; awaiting a refresh can lose clipboard access.
    await navigator.clipboard.writeText(currentStore.token);
    toast.success("Auth token copied");
  } catch {
    toast.error("Couldn't copy auth token. Please try again.");
  }
}

export function SyncAuthTokenRow() {
  const authStore = getPocketBase().authStore;
  const subscribe = useCallback(
    (onStoreChange: () => void) => authStore.onChange(onStoreChange),
    [authStore],
  );
  const hasToken = useSyncExternalStore(
    subscribe,
    () => Boolean(authStore.token),
    () => false,
  );
  const [isCopying, setIsCopying] = useState(false);

  async function handleCopy(): Promise<void> {
    setIsCopying(true);
    await copyAuthToken();
    setIsCopying(false);
  }

  if (!hasToken) return null;

  return (
    <SettingsRow
      label="MCP access"
      description="Connect an MCP client to your cloud tasks. Treat this token like a password."
    >
      <Button
        variant="subtle"
        className="min-h-11"
        onClick={handleCopy}
        disabled={isCopying}
        aria-busy={isCopying}
      >
        {isCopying ? "Copying…" : "Copy auth token"}
      </Button>
    </SettingsRow>
  );
}
