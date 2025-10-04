"use client";

interface TogglePillProps {
  active: boolean;
  label: string;
  onSelect: () => void;
  variant: "blue" | "amber";
}

export function TogglePill({ active, label, onSelect, variant }: TogglePillProps) {
  const activeBlue = "bg-blue-600 text-white border border-blue-600";
  const activeAmber = "bg-amber-500 text-white border border-amber-500";
  const inactive = "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 hover:border-slate-400";

  const className = active
    ? (variant === "blue" ? activeBlue : activeAmber)
    : inactive;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-all ${className}`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
