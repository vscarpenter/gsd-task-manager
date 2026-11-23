/**
 * Sign-out on a real database. It discards the sync queue, so each test reads
 * back what the user kept. Only PocketBase and toasts are faked.
 */
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { SyncSettings } from "@/components/settings/sync-settings";
import { useLogout } from "@/components/sync/use-logout";
import { getDb } from "@/lib/db";
import { getSyncQueue } from "@/lib/sync/queue";
import { createMockSyncConfig } from "@/tests/fixtures";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/sync/pocketbase-client", () => ({
  clearPocketBase: vi.fn(),
  getPocketBase: () => ({ authStore: { token: "", isValid: false, onChange: () => () => {} } }),
}));

async function queueChanges(...taskIds: string[]): Promise<void> {
  for (const taskId of taskIds) await getSyncQueue().enqueue("delete", taskId, null);
}

async function queued(): Promise<number> {
  return (await getDb().syncQueue.toArray()).length;
}

async function isSignedIn(): Promise<boolean | undefined> {
  return ((await getDb().syncMetadata.get("sync_config")) as { enabled?: boolean } | undefined)?.enabled;
}

function renderSettings() {
  return render(
    <SyncSettings
      onViewHistory={vi.fn()}
      onExport={vi.fn().mockResolvedValue(true)}
      onAccountDeleted={vi.fn()}
    />,
  );
}

async function clickSignOut(name = "Sign out"): Promise<void> {
  await userEvent.click(await screen.findByRole("button", { name }));
}

beforeEach(async () => {
  const db = getDb();
  await Promise.all(db.tables.map((table) => table.clear()));
  await db.syncMetadata.put(createMockSyncConfig({ userId: "user-1", email: "signed-in@example.com" }));
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sign out in Settings", () => {
  it("shows the signed-in account and a sign-out button", async () => {
    renderSettings();

    expect(await screen.findByText("signed-in@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("signs out at once when nothing is waiting", async () => {
    renderSettings();

    await clickSignOut();

    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Signed out"));
    expect(await isSignedIn()).toBe(false);
  });

  it("asks before it discards, then discards what the user agreed to", async () => {
    await queueChanges("a", "b", "c");
    renderSettings();

    await clickSignOut();
    expect(await screen.findByText(/3 unsynchronized changes/)).toBeInTheDocument();
    expect(await queued()).toBe(3);

    await clickSignOut("Sign out anyway");
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledWith("Signed out"));
    expect(await queued()).toBe(0);
  });

  it("keeps the session and the queue when it can't count unsynced changes", async () => {
    await queueChanges("a");
    renderSettings();
    await screen.findByRole("button", { name: "Sign out" });
    vi.spyOn(getDb().syncQueue, "count").mockRejectedValue(new Error("IndexedDB is busy"));

    await clickSignOut();

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("Sign out failed"));
    expect(await queued()).toBe(1);
    expect(await isSignedIn()).toBe(true);
  });

  it("asks when its first count fails and sign-out's own count works", async () => {
    await queueChanges("a");
    renderSettings();
    await screen.findByRole("button", { name: "Sign out" });
    vi.spyOn(getDb().syncQueue, "count").mockRejectedValueOnce(new Error("IndexedDB is busy"));

    await clickSignOut();

    expect(await screen.findByText(/1 unsynchronized change\./)).toBeInTheDocument();
    expect(await queued()).toBe(1);
  });

  it("asks again when more changes arrive while it's asking", async () => {
    await queueChanges("a");
    renderSettings();
    await clickSignOut();
    await screen.findByText(/1 unsynchronized change\./);

    await queueChanges("b");
    await clickSignOut("Sign out anyway");

    expect(await screen.findByText(/2 unsynchronized changes/)).toBeInTheDocument();
    expect(await queued()).toBe(2);
    expect(await isSignedIn()).toBe(true);
  });

  it("puts focus back on Cancel when it asks again", async () => {
    await queueChanges("a");
    renderSettings();
    await clickSignOut();
    await screen.findByText(/1 unsynchronized change\./);

    await queueChanges("b");
    await clickSignOut("Sign out anyway");
    await screen.findByText(/2 unsynchronized changes/);

    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
  });

  it("renders a new confirmation when it asks again, so the new count is announced", async () => {
    await queueChanges("a");
    renderSettings();
    await clickSignOut();
    const first = await screen.findByRole("group", { name: "Confirm sign out" });

    await queueChanges("b");
    await clickSignOut("Sign out anyway");
    await screen.findByText(/2 unsynchronized changes/);

    expect(screen.getByRole("group", { name: "Confirm sign out" })).not.toBe(first);
  });

  it("hides sign-out when no account is connected", async () => {
    await getDb().syncMetadata.clear();
    renderSettings();

    expect(await screen.findByText("Auto-sync")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();
  });
});

describe("sign out in the sync dialog", () => {
  it("asks again when more changes arrive while it's asking", async () => {
    await queueChanges("a");
    const { result } = renderHook(() =>
      useLogout({ onSignedOut: vi.fn(), setIsLoading: vi.fn(), setError: vi.fn() }),
    );
    await act(() => result.current.handleLogout());
    expect(result.current.pendingChanges).toBe(1);

    await queueChanges("b");
    await act(() => result.current.performLogout());

    expect(result.current.pendingChanges).toBe(2);
    expect(await queued()).toBe(2);
    expect(await isSignedIn()).toBe(true);
  });

  it("clears an older error when it asks again", async () => {
    await queueChanges("a");
    const setError = vi.fn();
    const { result } = renderHook(() => useLogout({ onSignedOut: vi.fn(), setIsLoading: vi.fn(), setError }));
    await act(() => result.current.handleLogout());
    setError.mockClear();

    await queueChanges("b");
    await act(() => result.current.performLogout());

    expect(setError).toHaveBeenCalledWith(null);
  });
});
