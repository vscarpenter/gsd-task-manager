import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthenticatedSection } from "@/components/sync/sync-auth-dialog-sections";

const logout = {
  showLogoutConfirm: false,
  pendingChanges: 0,
  handleLogout: vi.fn(),
  performLogout: vi.fn(),
  cancelLogout: vi.fn(),
};
const signOutEverywhere = {
  showConfirm: false,
  pendingChanges: 0,
  onRequest: vi.fn(),
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

function renderSignedIn(provider: string | null, email: string | null) {
  return render(
    <AuthenticatedSection
      syncStatus={{ enabled: true, email, provider }}
      error={null}
      isLoading={false}
      logout={logout}
      signOutEverywhere={signOutEverywhere}
    />,
  );
}

describe("<AuthenticatedSection> Apple account note", () => {
  it("warns that a private relay sign-in is a separate account", () => {
    renderSignedIn("apple", "abc@privaterelay.appleid.com");
    expect(screen.getByRole("note")).toHaveTextContent(/private relay email.*separate account/i);
  });

  it("says another provider elsewhere would be a different account", () => {
    renderSignedIn("apple", "me@example.com");
    expect(screen.getByRole("note")).toHaveTextContent(/Signed in with Apple.*different account/i);
  });

  it("stays quiet for Google and GitHub", () => {
    renderSignedIn("google", "me@example.com");
    expect(screen.queryByRole("note")).toBeNull();
  });
});
