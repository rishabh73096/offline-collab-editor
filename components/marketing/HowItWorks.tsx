import { PenLine, RefreshCw, History } from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";

const STEPS = [
  {
    icon: PenLine,
    title: "Write locally",
    body: "Open a document and start typing. Every keystroke lands in this device's storage first — nothing waits on a network round-trip.",
  },
  {
    icon: RefreshCw,
    title: "Sync automatically",
    body: "The moment you're back online, a CRDT diff — not a full overwrite — merges your changes with everyone else's, in either order, without conflicts.",
  },
  {
    icon: History,
    title: "Travel back anytime",
    body: "Every snapshot you save stays reachable. Restore one later without disrupting collaborators who are still working live.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-10">
        <Reveal className="mb-14 flex max-w-xl flex-col gap-3">
          <h2 className="font-serif text-3xl font-semibold text-ink">How it works</h2>
          <p className="text-ink-soft">Three steps, no spinners.</p>
        </Reveal>

        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6">
          {STEPS.map((step, index) => (
            <Reveal key={step.title} delayMs={index * 120} className="flex flex-col gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
                <step.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="font-serif text-lg font-semibold text-ink">
                <span className="mr-2 text-ink-faint">0{index + 1}</span>
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed text-ink-soft">{step.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
