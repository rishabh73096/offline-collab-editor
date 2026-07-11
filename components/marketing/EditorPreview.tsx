/**
 * A crafted stand-in for a product screenshot: built entirely from our own
 * design tokens (no external image asset to go stale or 404), showing the
 * three things the product actually does at a glance — live collaborators,
 * a synced/offline document, and version history.
 */
export function EditorPreview() {
  return (
    <div className="w-full max-w-lg rounded-2xl border border-border bg-surface shadow-2xl shadow-ink/10">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-brick/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-ochre/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-moss/60" />
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-ink-soft">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-moss-soft px-2.5 py-1 text-moss">
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Synced
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-6 py-6">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-serif text-base font-semibold text-ink">Q3 Launch Brief</span>
          <div className="flex -space-x-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-accent text-[10px] font-semibold text-surface">
              R
            </span>
            <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-teal text-[10px] font-semibold text-surface">
              A
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <span className="h-2.5 w-[92%] rounded-full bg-surface-soft" />
          <span className="h-2.5 w-[78%] rounded-full bg-surface-soft" />
          <span className="relative h-2.5 w-[85%] rounded-full bg-surface-soft">
            <span className="absolute -top-4 left-[60%] rounded-md bg-teal px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-surface">
              Amara is typing
            </span>
            <span className="absolute top-0 left-[60%] h-2.5 w-0.5 animate-pulse rounded-full bg-teal" />
          </span>
          <span className="h-2.5 w-[60%] rounded-full bg-surface-soft" />
          <span className="h-2.5 w-[70%] rounded-full bg-surface-soft" />
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-border pt-3 text-xs text-ink-faint">
          <span>Saved locally · works offline</span>
          <span className="inline-flex items-center gap-1 font-medium text-ink-soft">v12 · 2m ago</span>
        </div>
      </div>
    </div>
  );
}
