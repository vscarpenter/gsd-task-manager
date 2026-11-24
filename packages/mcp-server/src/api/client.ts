/**
 * Replace the hostname (and port) in a PocketBase URL with a stable
 * `[pocketbase-host]` placeholder so error messages can be safely shared
 * (chat logs, screenshots, bug reports) without leaking a private
 * self-hosted endpoint. The user's local config still has the real URL.
 */
export function redactPocketBaseHost(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//[pocketbase-host]`;
  } catch {
    return '[pocketbase-host]';
  }
}
