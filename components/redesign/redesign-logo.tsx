/**
 * Editorial-palette version of the GSD logo for the redesign sidebar.
 * Uses the redesign's earthy quadrant tokens (q1–q4) so it adapts to
 * light/dark mode via the `.redesign-scope` CSS variables. Matches the
 * conceptual structure of the full `GsdLogo` (2×2 grid + checkmark in
 * the urgent+important quadrant) but tuned for the smaller 30px slot.
 */
export function RedesignLogo({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {/* Card background so the logo reads on any sidebar tone */}
      <rect x="0" y="0" width="40" height="40" rx="8" fill="var(--paper)" />

      {/* 2×2 quadrant grid — top row is the "important" row,
          matching the Canvas view's axis orientation */}
      <rect x="4" y="4" width="15.5" height="15.5" rx="3" fill="var(--q2-tint)" />
      <rect x="20.5" y="4" width="15.5" height="15.5" rx="3" fill="var(--q1-tint)" />
      <rect x="4" y="20.5" width="15.5" height="15.5" rx="3" fill="var(--q4-tint)" />
      <rect x="20.5" y="20.5" width="15.5" height="15.5" rx="3" fill="var(--q3-tint)" />

      {/* Check in the Do-First quadrant */}
      <path
        d="M23.5 12.25L26 14.75L30.5 10.25"
        stroke="var(--q1)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Subtle outline that sits with the editorial line treatment */}
      <rect
        x="0.5"
        y="0.5"
        width="39"
        height="39"
        rx="7.5"
        stroke="var(--line)"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  );
}
