/**
 * Tag normalization, matching the clients: web's `appendTag`
 * (components/matrix-simplified/use-edit-draft-state.ts) and iOS's `addTag`.
 * Trim, lowercase, strip one leading #, drop empties, and drop repeats.
 * Tags stored before this rule can still be un-normalized, so comparisons against
 * stored tags normalize the stored side too.
 */
export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/^#/, '');
}

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map(normalizeTag).filter(Boolean))];
}
