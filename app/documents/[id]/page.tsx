import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/auth/session";
import { getDocumentForMember, DocumentNotFoundError } from "@/lib/repositories/documents";
import { DocumentWorkspace } from "@/components/editor/DocumentWorkspace";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
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
  return <DocumentWorkspace documentId={document.id} title={document.title} role={role} />;
}
