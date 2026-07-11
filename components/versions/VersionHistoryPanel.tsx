"use client";

import { useEffect, useState } from "react";
import { History, RotateCcw, Loader2, TriangleAlert, User } from "lucide-react";

interface VersionListItem {
  id: string;
  label: string | null;
  createdAt: string;
  createdBy: { id: string; name: string | null; email: string };
}

async function fetchVersions(documentId: string): Promise<VersionListItem[]> {
  const response = await fetch(`/api/documents/${documentId}/versions`);
  if (!response.ok) {
    throw new Error("Failed to load version history");
  }
  const data = (await response.json()) as { versions: VersionListItem[] };
  return data.versions;
}

export function VersionHistoryPanel({ documentId, canRestore }: { documentId: string; canRestore: boolean }) {
  const [versions, setVersions] = useState<VersionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchVersions(documentId)
      .then((loaded) => {
        if (!cancelled) {
          setVersions(loaded);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load version history.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  async function handleRestore(versionId: string) {
    setRestoringId(versionId);
    setError(null);
    try {
      const response = await fetch(`/api/documents/${documentId}/versions/${versionId}/restore`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Restore failed");
      }
      setConfirmingId(null);
      setVersions(await fetchVersions(documentId));
    } catch {
      setError("Restore failed. The collaboration server may be unavailable — try again in a moment.");
    } finally {
      setRestoringId(null);
    }
  }

  if (versions === null && !error) {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-faint">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading version history…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-lg bg-brick-soft px-3 py-2 text-sm text-brick">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {versions !== null && versions.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong px-6 py-14 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-soft text-ink-faint">
            <History className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-sm text-ink-soft">
            No saved versions yet. Use &ldquo;Save version&rdquo; from the editor to capture a snapshot.
          </p>
        </div>
      )}

      <ol className="flex flex-col">
        {versions?.map((version, index) => (
          <li key={version.id} className="relative flex gap-4 pb-6 last:pb-0">
            {index < versions.length - 1 && (
              <span className="absolute top-8 left-3.75 h-[calc(100%-1.75rem)] w-px bg-border" aria-hidden="true" />
            )}
            <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <History className="h-4 w-4" aria-hidden="true" />
            </span>

            <div className="flex flex-1 flex-col gap-2 rounded-xl border border-border bg-surface px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">{version.label ?? "Untitled snapshot"}</span>
                <span className="text-xs text-ink-faint">
                  {new Date(version.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                <User className="h-3.5 w-3.5" aria-hidden="true" />
                {version.createdBy.name ?? version.createdBy.email}
              </span>

              {canRestore &&
                (confirmingId === version.id ? (
                  <div className="mt-1 flex items-center gap-2 border-t border-border pt-2.5">
                    <span className="text-xs text-ink-soft">Restore this version?</span>
                    <button
                      type="button"
                      onClick={() => void handleRestore(version.id)}
                      disabled={restoringId === version.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-surface transition-colors hover:bg-accent-hover disabled:opacity-60"
                    >
                      {restoringId === version.id && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                      {restoringId === version.id ? "Restoring…" : "Confirm"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-ink-soft hover:text-ink"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(version.id)}
                    className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:border-border-strong hover:text-ink"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    Restore
                  </button>
                ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
