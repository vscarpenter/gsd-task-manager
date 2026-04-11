"use client";

interface TogglePillProps {
  active: boolean;
  label: string;
  onSelect: () => void;
  variant: "blue" | "amber";
}

export function TogglePill({ active, label, onSelect, variant }: TogglePillProps) {
  const activeBlue = "border-blue-500 bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-600/25";
  const activeAmber = "border-amber-500 bg-gradient-to-b from-amber-400 to-amber-500 text-white shadow-sm shadow-amber-500/25";
  const inactive = "border-border/80 bg-background/80 text-foreground hover:border-border hover:bg-background";

  const className = active
    ? (variant === "blue" ? activeBlue : activeAmber)
    : inactive;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex-1 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.14em] transition-all duration-200 ${className}`}
      aria-pressed={active}
    >
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full transition-all ${
            active
              ? "bg-white/95 shadow-[0_0_0_4px_rgba(255,255,255,0.18)]"
              : "bg-foreground-muted/35"
          }`}
          aria-hidden="true"
        />
      </span>
    </button>
  );
}
