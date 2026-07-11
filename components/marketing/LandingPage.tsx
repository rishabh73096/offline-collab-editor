import Link from "next/link";
import { ArrowRight, HardDrive, Users, GitMerge, RefreshCw, History, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { EditorPreview } from "@/components/marketing/EditorPreview";

const FEATURES = [
  {
    icon: HardDrive,
    tone: "accent" as const,
    title: "Local-first storage",
    body: "Every document lives on your device first. Open, edit, and close with zero network requests blocking the page.",
  },
  {
    icon: Users,
    tone: "teal" as const,
    title: "Real-time collaboration",
    body: "See collaborators' cursors and edits the moment they happen, over a purpose-built WebSocket sync server.",
  },
  {
    icon: GitMerge,
    tone: "moss" as const,
    title: "Conflict-free merging",
    body: "Built on CRDTs: two people editing the same sentence offline both keep their words when they reconnect.",
  },
  {
    icon: RefreshCw,
    tone: "ochre" as const,
    title: "Offline sync queue",
    body: "Lose your connection mid-sentence, keep typing. Everything reconciles automatically the moment you're back.",
  },
  {
    icon: History,
    tone: "accent" as const,
    title: "Version history",
    body: "Capture a snapshot any time and step back to it later, without disrupting collaborators still working live.",
  },
  {
    icon: ShieldCheck,
    tone: "teal" as const,
    title: "Roles that are enforced",
    body: "Owner, Editor, Viewer — checked on every read, every write, and every realtime message, not just the UI.",
  },
];

const TONE_STYLES = {
  accent: "bg-accent-soft text-accent",
  teal: "bg-teal-soft text-teal",
  moss: "bg-moss-soft text-moss",
  ochre: "bg-ochre-soft text-ochre",
};

export function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:px-10">
          <Logo />
          <nav className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-surface transition-colors hover:bg-accent-hover"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="bg-grain">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-14 px-6 py-20 sm:px-10 lg:grid-cols-[1.05fr_1fr] lg:py-28">
            <div className="flex flex-col items-start gap-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3 py-1 text-xs font-medium text-ink-soft">
                Works offline. Merges without conflict.
              </span>
              <h1 className="font-serif text-4xl leading-[1.1] font-semibold text-ink sm:text-5xl">
                Write anywhere. <br />
                Never lose a word.
              </h1>
              <p className="max-w-md text-base leading-relaxed text-ink-soft">
                A document editor that treats your device as the source of truth — not the server. Edit on a plane,
                collaborate in real time, and roll back to any earlier draft, without ever waiting on a spinner.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-surface transition-colors hover:bg-accent-hover"
                >
                  Start writing
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full border border-border-strong px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-surface-soft"
                >
                  Sign in
                </Link>
              </div>
            </div>

            <div className="flex justify-center lg:justify-end">
              <EditorPreview />
            </div>
          </div>
        </section>

        {/* Feature modules */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-10">
            <div className="mb-12 flex max-w-xl flex-col gap-3">
              <h2 className="font-serif text-3xl font-semibold text-ink">Built for the hard part</h2>
              <p className="text-ink-soft">
                Not a to-do list with a rich-text field. Every piece here solves a specific distributed-systems
                problem that shows up the moment more than one person — or one flaky connection — is involved.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="flex flex-col gap-4 rounded-2xl border border-border bg-paper p-6 transition-colors hover:border-border-strong"
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${TONE_STYLES[feature.tone]}`}
                  >
                    <feature.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="font-serif text-lg font-semibold text-ink">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-ink-soft">{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA banner */}
        <section className="border-t border-border">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 py-20 text-center sm:px-10">
            <h2 className="font-serif text-3xl font-semibold text-ink">Your next draft is waiting.</h2>
            <p className="max-w-md text-ink-soft">
              Free to use. No credit card. Your first document is one click away.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-surface transition-colors hover:bg-accent-hover"
            >
              Create your account
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-ink-faint sm:flex-row sm:px-10">
          <Logo className="opacity-80" />
          <p>Local-first, offline-capable, conflict-free.</p>
        </div>
      </footer>
    </div>
  );
}
