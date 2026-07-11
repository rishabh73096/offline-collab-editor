"use client";

import Link from "next/link";
import type { Role } from "@prisma/client";
import { ArrowLeft, History, Eye, Loader2 } from "lucide-react";
import { useDocument } from "@/hooks/useDocument";
import { DocumentEditor } from "@/components/editor/DocumentEditor";
import { SyncStatusBadge } from "@/components/documents/SyncStatusBadge";
import { SaveVersionButton } from "@/components/versions/SaveVersionButton";

const ROLE_STYLES: Record<Role, string> = {
  OWNER: "bg-moss-soft text-moss",
  EDITOR: "bg-teal-soft text-teal",
  VIEWER: "bg-surface-soft text-ink-soft",
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
    <div className="flex flex-1 flex-col px-6 py-8 sm:px-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <Link
              href="/documents"
              className="inline-flex items-center gap-1.5 text-sm text-ink-faint transition-colors hover:text-ink-soft"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Documents
            </Link>
            <h1 className="font-serif text-xl font-semibold text-ink">{title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SyncStatusBadge />
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_STYLES[role]}`}>{role}</span>
            <Link
              href={`/documents/${documentId}/history`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-border-strong hover:text-ink"
            >
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              History
            </Link>
            {role !== "VIEWER" && <SaveVersionButton documentId={documentId} />}
          </div>
        </header>

        {isReady && ytext ? (
          <>
            {role === "VIEWER" && (
              <p
                className="flex items-center gap-2 rounded-lg bg-surface-soft px-3 py-2 text-sm text-ink-soft"
                role="status"
              >
                <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
                You have view-only access to this document.
              </p>
            )}
            <DocumentEditor ytext={ytext} readOnly={role === "VIEWER"} />
            <p className="text-xs text-ink-faint">Stored locally on this device. Works offline.</p>
          </>
        ) : (
          <div
            className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-ink-faint"
            role="status"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading from local storage…
          </div>
        )}
      </div>
    </div>
  );
}
