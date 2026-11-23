/** Mark: a W whose last stroke climbs like a rising probability line. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
    >
      <rect width="32" height="32" rx="8" fill="var(--accent)" />
      <path
        d="M6.5 10.5 L11 22.5 L16 13.5 L20.5 22.5 L26 7.5"
        fill="none"
        stroke="var(--on-accent)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      <span
        className="font-wide text-[1.2rem] font-extrabold leading-none tracking-[-0.02em]"
        aria-label="Winala"
      >
        winala
      </span>
    </span>
  );
}
