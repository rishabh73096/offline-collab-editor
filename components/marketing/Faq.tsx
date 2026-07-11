"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";

const FAQS = [
  {
    question: "What happens if I close my laptop mid-sentence?",
    answer:
      "Nothing is lost. Your edit already landed in this device's local storage the moment you typed it — reopen the document and it's exactly as you left it, synced the next time you're online.",
  },
  {
    question: "What if two people edit the same line at the same time?",
    answer:
      "Both edits survive. The document is a CRDT, not a \"last write wins\" file — merges are deterministic and conflict-free, whichever order the changes arrive in.",
  },
  {
    question: "Can a Viewer accidentally change something?",
    answer:
      "No. Role checks run at the database layer, the API layer, and the realtime layer independently — a Viewer's edits are never applied, even if someone bypasses the UI entirely.",
  },
  {
    question: "Is restoring an old version destructive?",
    answer:
      "No. A restore is applied as a normal, live, broadcast edit and logged as a new version — nothing is silently overwritten, and collaborators working at that moment simply see it happen.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="border-t border-border bg-surface">
      <div className="mx-auto w-full max-w-3xl px-6 py-20 sm:px-10">
        <Reveal className="mb-10 flex flex-col gap-3">
          <h2 className="font-serif text-3xl font-semibold text-ink">Questions people actually ask</h2>
        </Reveal>

        <dl className="flex flex-col divide-y divide-border border-y border-border">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <Reveal key={faq.question} delayMs={index * 80}>
                <dt>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 py-5 text-left"
                  >
                    <span className="font-medium text-ink">{faq.question}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-ink-faint transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </button>
                </dt>
                <dd
                  className={`grid transition-all duration-300 ease-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                >
                  <div className="overflow-hidden">
                    <p className="pb-5 text-sm leading-relaxed text-ink-soft">{faq.answer}</p>
                  </div>
                </dd>
              </Reveal>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
