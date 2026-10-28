import { XIcon } from "lucide-react";

/** One removable tag. */
export function TagChip({ tag, onRemove }: { tag: string; onRemove: (tag: string) => void }): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-background-muted px-2 py-0.5 text-caption font-medium text-foreground-muted">
      <span className="opacity-60">#</span>
      {tag}
      {/* Removes a chip from an unsaved draft — nothing is persisted until
          Save, and re-adding is one keystroke. A confirmation dialog on a
          tag chip would be worse UX than the risk it guards. */}
      {/* ui-craft-detect-ignore-next-line */}
      <button
        type="button"
        onClick={() => onRemove(tag)}
        aria-label={`Remove ${tag}`}
        className="rounded-xs hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <XIcon className="h-3 w-3" />
      </button>
    </span>
  );
}
