interface GsdLogoProps {
  className?: string;
  size?: number;
}

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
      {/* The four-pigment matrix: Q1 Do First (rust) with completion check,
          Q2 Schedule (tide), Q3 Delegate (ochre), Q4 Eliminate (slate). */}
      <rect x="2" y="2" width="7" height="7" rx="1.6" fill="var(--q1)" />
      <rect x="11" y="2" width="7" height="7" rx="1.6" fill="var(--q2)" />
      <rect x="2" y="11" width="7" height="7" rx="1.6" fill="var(--q3)" />
      <rect x="11" y="11" width="7" height="7" rx="1.6" fill="var(--q4)" />
      <path
        d="M3.7 5.5 L4.9 6.7 L7.3 4.2"
        fill="none"
        stroke="var(--ivory)"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
