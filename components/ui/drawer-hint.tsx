import { cn } from "@/lib/utils";

interface DrawerHintProps {
  /** Keyboard shortcut to display (defaults to "Esc"). */
  shortcut?: string;
  /** Action description ("to cancel", "to close"). */
  action?: string;
  className?: string;
}

/**
 * Mono caption for modal/drawer footers. Reusable shortcut hint, e.g.
 * "Esc to cancel". Pin to the bottom-right of a footer; the parent owns
 * positioning.
 */
export function DrawerHint({
  shortcut = "Esc",
  action = "to cancel",
  className,
}: DrawerHintProps) {
  return (
    <span className={cn("font-mono text-[11px] text-foreground-muted", className)}>
      <kbd className="rounded border border-border-muted bg-background-muted px-1 py-0.5 text-[10px]">
        {shortcut}
      </kbd>
      <span className="ml-1.5">{action}</span>
    </span>
  );
}
