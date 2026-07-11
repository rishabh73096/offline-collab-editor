import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { EditorPreview } from "@/components/marketing/EditorPreview";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid flex-1 grid-cols-1 lg:grid-cols-2">
      <div className="flex flex-col justify-between gap-10 px-6 py-10 sm:px-12 sm:py-12">
        <Link href="/">
          <Logo />
        </Link>

        <div className="mx-auto flex w-full max-w-sm flex-col items-start gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="font-serif text-2xl font-semibold text-ink">{title}</h1>
            <p className="text-sm text-ink-soft">{subtitle}</p>
          </div>
          {children}
        </div>

        <p className="text-xs text-ink-faint">Local-first, offline-capable, conflict-free.</p>
      </div>

      <div className="hidden items-center justify-center bg-grain border-l border-border bg-surface-soft p-12 lg:flex">
        <EditorPreview />
      </div>
    </div>
  );
}
