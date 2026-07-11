import Link from "next/link";
import { requireUserId } from "@/lib/auth/session";
import { listDocumentsForUser } from "@/lib/repositories/documents";
import { CreateDocumentForm } from "@/components/documents/CreateDocumentForm";
import { DocumentList } from "@/components/documents/DocumentList";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Logo } from "@/components/brand/Logo";

export default async function DocumentsPage() {
  const userId = await requireUserId();
  const memberships = await listDocumentsForUser(userId);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-5 sm:px-10">
          <Link href="/documents">
            <Logo />
          </Link>
          <SignOutButton />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-10 sm:px-10">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-2xl font-semibold text-ink">Your documents</h1>
          <p className="text-sm text-ink-soft">Everything here is saved to this device first, synced in the background.</p>
        </div>

        <CreateDocumentForm />

        <DocumentList documents={memberships.map((m) => ({ ...m.document, role: m.role }))} />
      </div>
    </div>
  );
}
