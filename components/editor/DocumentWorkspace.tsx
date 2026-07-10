"use client";

import Link from "next/link";
import type { Role } from "@prisma/client";
import { useDocument } from "@/hooks/useDocument";
import { DocumentEditor } from "@/components/editor/DocumentEditor";
import { SyncStatusBadge } from "@/components/documents/SyncStatusBadge";

const ROLE_STYLES: Record<Role, string> = {
  OWNER: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  EDITOR: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  VIEWER: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function DocumentWorkspace({
  documentId,
  title,
  role,
}: {
  documentId: string;
  title: string;
  role: Role;
}) {
  const { ytext, isReady } = useDocument(documentId);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 px-6 py-8 dark:bg-black sm:px-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Link href="/documents" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
              &larr; Back to documents
            </Link>
            <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <SyncStatusBadge />
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_STYLES[role]}`}>{role}</span>
          </div>
        </header>

        {isReady && ytext ? (
          <>
            {role === "VIEWER" && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400" role="status">
                You have view-only access to this document.
              </p>
            )}
            <DocumentEditor ytext={ytext} readOnly={role === "VIEWER"} />
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Stored locally on this device. Works offline.
            </p>
          </>
        ) : (
          <div
            className="flex min-h-[60vh] items-center justify-center text-sm text-zinc-500 dark:text-zinc-400"
            role="status"
          >
            Loading from local storage...
          </div>
        )}
      </div>
    </div>
  );
}
