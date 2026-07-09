import Link from "next/link";
import type { Role } from "@prisma/client";

interface DocumentListItem {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  role: Role;
}

const ROLE_STYLES: Record<Role, string> = {
  OWNER: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  EDITOR: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  VIEWER: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function DocumentList({ documents }: { documents: DocumentListItem[] }) {
  if (documents.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        No documents yet — create your first one above.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {documents.map((doc) => (
        <li key={doc.id}>
          <Link
            href={`/documents/${doc.id}`}
            className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium text-zinc-950 dark:text-zinc-50">{doc.title}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Updated {doc.updatedAt.toLocaleString()}
              </span>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_STYLES[doc.role]}`}>
              {doc.role}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
