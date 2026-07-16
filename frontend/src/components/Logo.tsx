/** EventWeaver brand mark — a woven causal chain of nodes. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="ew-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4d8eff" />
          <stop offset="1" stopColor="#571bc1" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#131314" />
      <path
        d="M14 40 L28 24 L40 36 L50 20"
        stroke="url(#ew-logo-g)"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="40" r="5" fill="#adc6ff" />
      <circle cx="28" cy="24" r="5" fill="#4d8eff" />
      <circle cx="40" cy="36" r="5" fill="#a78bfa" />
      <circle cx="50" cy="20" r="5" fill="#4edea3" />
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={size} />
      <span
        className="font-bold tracking-tight text-primary"
        style={{ fontFamily: 'var(--font-display)', fontSize: size * 0.75 }}
      >
        EventWeaver
      </span>
    </span>
  );
}
