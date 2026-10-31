import { describe, expect, it } from "vitest";
import { accountNote, accountNoteText, isRelayEmail } from "@/lib/apple-identity";

// Mirrors iOS `AppleIdentity` (GSDKit/Sources/GSDSync/AppleIdentity.swift).
describe("isRelayEmail", () => {
  it("recognizes an Apple private relay address, case-insensitively", () => {
    expect(isRelayEmail("abc123@privaterelay.appleid.com")).toBe(true);
    expect(isRelayEmail("ABC123@PrivateRelay.AppleID.com")).toBe(true);
  });

  it("rejects an ordinary address", () => {
    expect(isRelayEmail("me@example.com")).toBe(false);
  });
});

describe("accountNote", () => {
  it("is a separate account for a relay address", () => {
    expect(accountNote("apple", "abc@privaterelay.appleid.com")).toBe("relay-separate-account");
  });

  it("may differ for any other Apple sign-in, even without an email", () => {
    expect(accountNote("apple", "me@example.com")).toBe("apple-may-differ");
    expect(accountNote("apple", null)).toBe("apple-may-differ");
  });

  it("is nothing for Google, GitHub, or an unknown provider", () => {
    expect(accountNote("google", "me@example.com")).toBeNull();
    expect(accountNote("github", null)).toBeNull();
    expect(accountNote(null, "me@example.com")).toBeNull();
  });

  it("reads the provider case-insensitively", () => {
    expect(accountNote("Apple", "me@example.com")).toBe("apple-may-differ");
  });
});

describe("accountNoteText", () => {
  it("says a relay sign-in is a separate account", () => {
    expect(accountNoteText("relay-separate-account")).toBe(
      "Signed in with a private relay email. This is a separate account from your tasks on other devices.",
    );
  });

  it("says another provider on other devices is a different account", () => {
    expect(accountNoteText("apple-may-differ")).toBe(
      "Signed in with Apple. If you use Google or GitHub on your other devices, that’s a different account and won’t show the same tasks.",
    );
  });
});
