/**
 * Hand-drawn mark, not a stock icon: a folded page with a second page
 * peeking out behind it (two collaborators, one document) and a small
 * accent dot standing in for a live cursor/presence indicator.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <path
        d="M9 5.5h11.5L26 11v15a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 26V7A1.5 1.5 0 0 1 9 5.5Z"
        fill="var(--surface)"
        stroke="var(--ink)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M20.5 5.5 26 11h-4a1.5 1.5 0 0 1-1.5-1.5V5.5Z" fill="var(--border-strong)" />
      <path d="M11.5 15.5h9M11.5 19.5h6.5" stroke="var(--ink-soft)" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="23" cy="24" r="4" fill="var(--accent)" stroke="var(--paper)" strokeWidth="1.5" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark className="h-7 w-7 shrink-0" />
      <span className="font-serif text-lg font-semibold tracking-tight text-ink">Marginal</span>
    </span>
  );
}
