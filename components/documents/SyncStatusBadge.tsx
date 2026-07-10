"use client";

import { useSyncStore, type SyncStatus } from "@/lib/store/syncStore";

const LABELS: Record<SyncStatus, string> = {
  offline: "Offline",
  connecting: "Connecting…",
  syncing: "Syncing…",
  synced: "Synced",
  error: "Sync error",
};

const STYLES: Record<SyncStatus, string> = {
  offline: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  connecting: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  syncing: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  synced: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  error: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export function SyncStatusBadge() {
  const status = useSyncStore((state) => state.status);

  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}
