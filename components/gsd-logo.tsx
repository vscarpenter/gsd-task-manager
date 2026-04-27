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
      <rect x="2" y="2" width="7" height="7" rx="1.6" fill="#1d4ed8" opacity="0.32" />
      <rect x="11" y="2" width="7" height="7" rx="1.6" fill="#c2410c" />
      <rect x="2" y="11" width="7" height="7" rx="1.6" fill="#15803d" opacity="0.32" />
      <rect x="11" y="11" width="7" height="7" rx="1.6" fill="#854d0e" opacity="0.32" />
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
