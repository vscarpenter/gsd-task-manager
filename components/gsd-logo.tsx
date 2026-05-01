interface GsdLogoProps {
  className?: string;
  size?: number;
}

/**
 * Variant A — Mosaic. Four-square matrix mark in the muted earth-tone palette
 * (sage / dusty-blue / warm-taupe / slate-gray). Q1 (top-right) is solid to
 * preserve the "Do First" emphasis from the legacy mark.
 *
 * This is the active brand mark — wired into GsdLogoLockup by default. To
 * switch to variant B, change `<GsdLogo />` below to `<GsdLogoMonochrome />`.
 */
export function GsdLogo({ className, size = 28 }: GsdLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="2"  y="2"  width="7" height="7" rx="1.6" fill="rgb(var(--quadrant-accent-q2))" opacity="0.32" />
      <rect x="11" y="2"  width="7" height="7" rx="1.6" fill="rgb(var(--quadrant-accent-q1))" />
      <rect x="2"  y="11" width="7" height="7" rx="1.6" fill="rgb(var(--quadrant-accent-q3))" opacity="0.32" />
      <rect x="11" y="11" width="7" height="7" rx="1.6" fill="rgb(var(--quadrant-accent-q4))" opacity="0.32" />
    </svg>
  );
}

/**
 * Variant B — Duotone. Same four-square mosaic but rendered in just two inks:
 * foreground (deep charcoal) for three quadrants and the brand accent
 * (muted indigo) for Q1. Reads as a single, refined editorial mark — less
 * "color identity," more "typographic." Try this if the multi-color mosaic
 * feels too playful for the new aesthetic.
 *
 * To activate, change `<GsdLogo />` to `<GsdLogoMonochrome />` inside
 * `GsdLogoLockup`.
 */
export function GsdLogoMonochrome({ className, size = 28 }: GsdLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="2"  y="2"  width="7" height="7" rx="1.6" fill="rgb(var(--foreground))" opacity="0.20" />
      <rect x="11" y="2"  width="7" height="7" rx="1.6" fill="rgb(var(--accent))" />
      <rect x="2"  y="11" width="7" height="7" rx="1.6" fill="rgb(var(--foreground))" opacity="0.20" />
      <rect x="11" y="11" width="7" height="7" rx="1.6" fill="rgb(var(--foreground))" opacity="0.20" />
    </svg>
  );
}

export function GsdLogoLockup({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <GsdLogo size={28} />
      <span
        className="font-semibold text-foreground"
        style={{ letterSpacing: "-0.02em" }}
      >
        GSD
      </span>
    </span>
  );
}
