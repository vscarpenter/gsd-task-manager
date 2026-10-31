/**
 * What to tell a person who signed in with Apple about which account they landed on.
 * Mirrors iOS `AppleIdentity` (GSDKit/Sources/GSDSync/AppleIdentity.swift).
 *
 * PocketBase treats each OAuth identity as a distinct user unless the verified emails match,
 * so the provider a person picks decides which tasks they see. Apple's private relay address
 * is unique per app, so it never matches the email another client knows. The failure is
 * silent (sync looks broken, not pointed somewhere else), hence the note.
 */
export type AccountNote = "relay-separate-account" | "apple-may-differ";

export function isRelayEmail(email: string): boolean {
  return email.toLowerCase().endsWith("@privaterelay.appleid.com");
}

/** The note for a signed-in account, or null when there is nothing worth saying. */
export function accountNote(provider: string | null | undefined, email: string | null | undefined): AccountNote | null {
  if (provider?.toLowerCase() !== "apple") return null;
  return email && isRelayEmail(email) ? "relay-separate-account" : "apple-may-differ";
}

/** The iOS copy, with "your web tasks" and "on the web" turned into "your other devices" for this client. */
export function accountNoteText(note: AccountNote): string {
  return note === "relay-separate-account"
    ? "Signed in with a private relay email. This is a separate account from your tasks on other devices."
    : "Signed in with Apple. If you use Google or GitHub on your other devices, that’s a different account and won’t show the same tasks.";
}
