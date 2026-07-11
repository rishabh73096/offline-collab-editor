"use client";

import { useEffect, useState } from "react";

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
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading version history…</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {versions !== null && versions.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No saved versions yet. Use &ldquo;Save version&rdquo; from the editor to capture a snapshot.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {versions?.map((version) => (
          <li
            key={version.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {version.label ?? "Untitled snapshot"}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {new Date(version.createdAt).toLocaleString()} · {version.createdBy.name ?? version.createdBy.email}
              </span>
            </div>

            {canRestore &&
              (confirmingId === version.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Restore this version?</span>
                  <button
                    type="button"
                    onClick={() => void handleRestore(version.id)}
                    disabled={restoringId === version.id}
                    className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {restoringId === version.id ? "Restoring…" : "Confirm"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingId(version.id)}
                  className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Restore
                </button>
              ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
