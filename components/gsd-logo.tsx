export function GsdLogo({ className }: { className?: string }) {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 2x2 Matrix Grid */}
      <rect x="2" y="2" width="17" height="17" rx="3" fill="#dbeafe" />
      <rect x="21" y="2" width="17" height="17" rx="3" fill="#fef9c3" />
      <rect x="2" y="21" width="17" height="17" rx="3" fill="#d1fae5" />
      <rect x="21" y="21" width="17" height="17" rx="3" fill="#f3e8ff" />

      {/* Checkmark in top-left quadrant (urgent + important) */}
      <path
        d="M7 10.5L9.5 13L14 8.5"
        stroke="#2563eb"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Border outline */}
      <rect
        x="2"
        y="2"
        width="36"
        height="36"
        rx="6"
        stroke="#64748b"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}
