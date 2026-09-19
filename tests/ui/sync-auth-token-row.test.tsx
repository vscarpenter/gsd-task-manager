import { act, fireEvent, render, screen } from "@testing-library/react";
import { BaseAuthStore } from "pocketbase";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { SyncAuthTokenRow } from "@/components/settings/sync-auth-token-row";
import { getPocketBase } from "@/lib/sync/pocketbase-client";

vi.mock("@/lib/sync/pocketbase-client", () => ({ getPocketBase: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function tokenFor(id: string, expiresInSeconds = 3600): string {
  const payload = { id, exp: Math.floor(Date.now() / 1000) + expiresInSeconds };
  return `${btoa('{"alg":"HS256"}')}.${btoa(JSON.stringify(payload))}.test-signature`;
}

let authStore: BaseAuthStore;
let writeText: ReturnType<typeof vi.fn>;
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");

function useStore(store: BaseAuthStore): void {
  vi.mocked(getPocketBase).mockReturnValue({ authStore: store } as ReturnType<typeof getPocketBase>);
}

function clickCopy(): void {
  fireEvent.click(screen.getByRole("button", { name: "Copy auth token" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  authStore = new BaseAuthStore();
  authStore.save(tokenFor("first-account"), { id: "first-account", email: "test@example.com" });
  useStore(authStore);
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
});

afterEach(() => {
  vi.restoreAllMocks();
  if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  else Reflect.deleteProperty(navigator, "clipboard");
});

describe("SyncAuthTokenRow", () => {
  it("copies only the raw token without rendering the credential or account record", async () => {
    const { container } = render(<SyncAuthTokenRow />);
    expect(screen.getByText("MCP access")).toBeInTheDocument();
    expect(container.innerHTML).not.toContain(authStore.token);
    expect(container.innerHTML).not.toContain("test@example.com");

    clickCopy();
    await act(async () => {});

    expect(writeText).toHaveBeenCalledExactlyOnceWith(authStore.token);
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("Auth token copied");
    expect(container.innerHTML).not.toContain(authStore.token);
  });

  it("reads a refreshed token from the current account at click time", async () => {
    render(<SyncAuthTokenRow />);
    const replacement = tokenFor("second-account");
    act(() => authStore.save(replacement, { id: "second-account" }));

    clickCopy();
    await act(async () => {});

    expect(writeText).toHaveBeenCalledExactlyOnceWith(replacement);
  });

  it("waits for the write to succeed and prevents duplicate clicks while pending", async () => {
    let resolveWrite!: () => void;
    writeText.mockReturnValue(new Promise<void>((resolve) => { resolveWrite = resolve; }));
    render(<SyncAuthTokenRow />);

    clickCopy();
    const pending = screen.getByRole("button", { name: "Copying…" });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    expect(writeText).toHaveBeenCalledOnce();
    expect(toast.success).not.toHaveBeenCalled();

    await act(async () => resolveWrite());
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("Auth token copied");
    expect(screen.getByRole("button", { name: "Copy auth token" })).toBeEnabled();
  });

  it("rejects an expired token", async () => {
    authStore.save(tokenFor("expired", -1));
    render(<SyncAuthTokenRow />);

    clickCopy();
    await act(async () => {});

    expect(writeText).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledExactlyOnceWith("Sign in again to copy your token.");
  });

  it("rechecks expiry even when no auth-store event fires", async () => {
    render(<SyncAuthTokenRow />);
    vi.spyOn(authStore, "isValid", "get").mockReturnValue(false);

    clickCopy();
    await act(async () => {});

    expect(writeText).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledExactlyOnceWith("Sign in again to copy your token.");
  });

  it("rejects a missing token if the client changes just before a click", async () => {
    render(<SyncAuthTokenRow />);
    useStore(new BaseAuthStore());

    clickCopy();
    await act(async () => {});

    expect(writeText).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledExactlyOnceWith("Sign in again to copy your token.");
  });

  it("hides the row when signed out", () => {
    authStore.clear();
    render(<SyncAuthTokenRow />);
    expect(screen.queryByRole("button", { name: "Copy auth token" })).not.toBeInTheDocument();
  });

  it("reacts to sign-out and a new client session while Settings remains mounted", () => {
    render(<SyncAuthTokenRow />);
    const nextStore = new BaseAuthStore();
    act(() => {
      authStore.clear();
      useStore(nextStore);
    });
    expect(screen.queryByText("MCP access")).not.toBeInTheDocument();

    act(() => nextStore.save(tokenFor("signed-in-again")));
    expect(screen.getByRole("button", { name: "Copy auth token" })).toBeEnabled();
  });

  it("reports clipboard failure without exposing the error or token and permits retry", async () => {
    writeText.mockRejectedValueOnce(new Error(`Clipboard rejected ${authStore.token}`));
    render(<SyncAuthTokenRow />);

    clickCopy();
    await act(async () => {});

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledExactlyOnceWith("Couldn't copy auth token. Please try again.");
    expect(screen.getByRole("button", { name: "Copy auth token" })).toBeEnabled();

    clickCopy();
    await act(async () => {});
    expect(toast.success).toHaveBeenCalledExactlyOnceWith("Auth token copied");
  });

  it("handles browsers without clipboard support", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    render(<SyncAuthTokenRow />);

    clickCopy();
    await act(async () => {});

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledExactlyOnceWith("Couldn't copy auth token. Please try again.");
    expect(screen.getByRole("button", { name: "Copy auth token" })).toBeEnabled();
  });
});
