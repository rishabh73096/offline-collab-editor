import { requireUserId } from "@/lib/auth/session";
import { listDocumentsForUser } from "@/lib/repositories/documents";
import { CreateDocumentForm } from "@/components/documents/CreateDocumentForm";
import { DocumentList } from "@/components/documents/DocumentList";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function DocumentsPage() {
  const userId = await requireUserId();
  const memberships = await listDocumentsForUser(userId);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 px-6 py-10 dark:bg-black sm:px-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Your documents</h1>
          <SignOutButton />
        </header>

        <CreateDocumentForm />

        <DocumentList documents={memberships.map((m) => ({ ...m.document, role: m.role }))} />
      </div>
    </div>
  );
}
