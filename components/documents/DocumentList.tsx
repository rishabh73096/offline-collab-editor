import Link from "next/link";
import type { Role } from "@prisma/client";
import { FileText, Clock, FolderOpen } from "lucide-react";

interface DocumentListItem {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  role: Role;
}

const ROLE_STYLES: Record<Role, string> = {
  OWNER: "bg-moss-soft text-moss",
  EDITOR: "bg-teal-soft text-teal",
  VIEWER: "bg-surface-soft text-ink-soft",
};

export function DocumentList({ documents }: { documents: DocumentListItem[] }) {
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong px-6 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-soft text-ink-faint">
          <FolderOpen className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium text-ink">No documents yet</p>
        <p className="max-w-xs text-sm text-ink-soft">
          Create your first document above — it&apos;ll be saved to this device instantly, synced when you&apos;re online.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {documents.map((doc) => (
        <li key={doc.id}>
          <Link
            href={`/documents/${doc.id}`}
            className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-border-strong hover:bg-surface-soft"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <FileText className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_STYLES[doc.role]}`}>
                {doc.role}
              </span>
            </div>
            <span className="line-clamp-2 font-serif text-base font-semibold text-ink">{doc.title}</span>
            <span className="mt-auto inline-flex items-center gap-1.5 text-xs text-ink-faint">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              Updated {doc.updatedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
