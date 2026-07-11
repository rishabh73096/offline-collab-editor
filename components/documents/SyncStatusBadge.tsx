"use client";

import { CloudCheck, CloudOff, RefreshCw, CircleAlert, Loader2 } from "lucide-react";
import { useSyncStore, type SyncStatus } from "@/lib/store/syncStore";

const LABELS: Record<SyncStatus, string> = {
  offline: "Offline",
  connecting: "Connecting…",
  syncing: "Syncing…",
  synced: "Synced",
  error: "Sync error",
};

const STYLES: Record<SyncStatus, string> = {
  offline: "bg-surface-soft text-ink-soft",
  connecting: "bg-ochre-soft text-ochre",
  syncing: "bg-ochre-soft text-ochre",
  synced: "bg-moss-soft text-moss",
  error: "bg-brick-soft text-brick",
};

const ICONS: Record<SyncStatus, typeof CloudCheck> = {
  offline: CloudOff,
  connecting: Loader2,
  syncing: RefreshCw,
  synced: CloudCheck,
  error: CircleAlert,
};

const SPIN: Partial<Record<SyncStatus, string>> = {
  connecting: "animate-spin",
  syncing: "animate-spin",
};

export function SyncStatusBadge() {
  const status = useSyncStore((state) => state.status);
  const Icon = ICONS[status];

  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${STYLES[status]}`}
    >
      <Icon className={`h-3.5 w-3.5 ${SPIN[status] ?? ""}`} aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}
