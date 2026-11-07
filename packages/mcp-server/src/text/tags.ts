/**
 * Tag normalization, matching the clients: web's `appendTag`
 * (components/matrix-simplified/use-edit-draft-state.ts) and iOS's `addTag`.
 * Trim, lowercase, strip one leading #, drop empties, and drop repeats.
 */
export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase().replace(/^#/, '');
    if (tag) seen.add(tag);
  }
  return [...seen];
}
