import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUserId } from "@/lib/auth/session";
import { getDocumentForMember, DocumentNotFoundError } from "@/lib/repositories/documents";
import { MembersPanel } from "@/components/members/MembersPanel";

export default async function DocumentSharePage({ params }: { params: Promise<{ id: string }> }) {
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
    <div className="flex flex-1 flex-col px-6 py-8 sm:px-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-1.5">
          <Link
            href={`/documents/${document.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-ink-faint transition-colors hover:text-ink-soft"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {document.title}
          </Link>
          <h1 className="font-serif text-xl font-semibold text-ink">Who has access</h1>
        </header>

        <MembersPanel documentId={document.id} currentUserId={userId} isOwner={role === "OWNER"} />
      </div>
    </div>
  );
}
