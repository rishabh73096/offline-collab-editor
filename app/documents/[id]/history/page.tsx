import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUserId } from "@/lib/auth/session";
import { getDocumentForMember, DocumentNotFoundError } from "@/lib/repositories/documents";
import { VersionHistoryPanel } from "@/components/versions/VersionHistoryPanel";

export default async function DocumentHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();

  let membership: Awaited<ReturnType<typeof getDocumentForMember>>;
  try {
    membership = await getDocumentForMember(userId, id);
  } catch (error) {
    if (error instanceof DocumentNotFoundError) {
      notFound();
    }
    throw error;
  }

  const { document, role } = membership;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 px-6 py-8 dark:bg-black sm:px-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <Link
            href={`/documents/${document.id}`}
            className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
          >
            &larr; Back to {document.title}
          </Link>
          <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Version history</h1>
        </header>

        <VersionHistoryPanel documentId={document.id} canRestore={role === "OWNER" || role === "EDITOR"} />
      </div>
    </div>
  );
}
