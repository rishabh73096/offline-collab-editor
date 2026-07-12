"use client";

import { useState, type RefObject } from "react";
import type * as Y from "yjs";
import { Sparkles, Wand2, X, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { applyRewriteResult, StaleSelectionError } from "@/lib/ai/applyRewrite";

const INSTRUCTION_PRESETS = ["Make it more formal", "Shorten it", "Fix grammar and spelling", "Expand on this"];

interface Selection {
  start: number;
  text: string;
}

async function streamCompletion(url: string, body: unknown, onChunk: (accumulated: string) => void): Promise<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? "AI request failed");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    accumulated += decoder.decode(value, { stream: true });
    onChunk(accumulated);
  }

  return accumulated;
}

export function AiToolbar({
  documentId,
  ytext,
  textareaRef,
  canRewrite,
}: {
  documentId: string;
  ytext: Y.Text;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  canRewrite: boolean;
}) {
  const [panel, setPanel] = useState<"summary" | "rewrite" | null>(null);

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState("");

  const [selection, setSelection] = useState<Selection | null>(null);
  const [instruction, setInstruction] = useState("");
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewritePreview, setRewritePreview] = useState<string | null>(null);

  async function handleSummarize() {
    setPanel("summary");
    setIsSummarizing(true);
    setSummary("");
    try {
      await streamCompletion(`/api/documents/${documentId}/ai/summarize`, { text: ytext.toString() }, setSummary);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not summarize");
      setPanel(null);
    } finally {
      setIsSummarizing(false);
    }
  }

  function openRewritePanel() {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? 0;
    const end = textarea?.selectionEnd ?? 0;
    if (!textarea || start === end) {
      toast.error("Select some text in the document first");
      return;
    }
    setSelection({ start, text: textarea.value.slice(start, end) });
    setRewritePreview(null);
    setInstruction("");
    setPanel("rewrite");
  }

  async function runRewrite(nextInstruction: string) {
    if (!selection) return;
    setInstruction(nextInstruction);
    setIsRewriting(true);
    setRewritePreview("");
    try {
      await streamCompletion(
        `/api/documents/${documentId}/ai/rewrite`,
        { text: selection.text, instruction: nextInstruction },
        setRewritePreview,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not rewrite");
      setRewritePreview(null);
    } finally {
      setIsRewriting(false);
    }
  }

  function handleApplyRewrite() {
    if (!selection || rewritePreview === null) return;
    try {
      applyRewriteResult(ytext, selection.start, selection.text, rewritePreview);
      toast.success("Rewrite applied");
      closePanel();
    } catch (error) {
      if (error instanceof StaleSelectionError) {
        toast.error("The text changed before the rewrite finished — try again");
      } else {
        toast.error("Could not apply the rewrite");
      }
    }
  }

  function closePanel() {
    setPanel(null);
    setSelection(null);
    setRewritePreview(null);
    setInstruction("");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleSummarize()}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-border-strong hover:text-ink"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Summarize
        </button>
        {canRewrite && (
          <button
            type="button"
            onClick={openRewritePanel}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-border-strong hover:text-ink"
          >
            <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
            Rewrite selection
          </button>
        )}
      </div>

      {panel === "summary" && (
        <div className="flex flex-col gap-2 rounded-xl border border-accent-soft-border bg-accent-soft p-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Summary
            </span>
            <button type="button" onClick={closePanel} aria-label="Close summary" className="text-ink-faint hover:text-ink">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          {isSummarizing && summary === "" ? (
            <div className="flex items-center gap-2 text-sm text-ink-soft">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Thinking…
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-ink">{summary}</p>
          )}
        </div>
      )}

      {panel === "rewrite" && selection && (
        <div className="flex flex-col gap-3 rounded-xl border border-accent-soft-border bg-accent-soft p-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accent">
              <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
              Rewrite selection
            </span>
            <button type="button" onClick={closePanel} aria-label="Close rewrite panel" className="text-ink-faint hover:text-ink">
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <p className="line-clamp-2 rounded-lg bg-surface px-3 py-2 text-xs text-ink-faint italic">
            &ldquo;{selection.text}&rdquo;
          </p>

          {rewritePreview === null ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {INSTRUCTION_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => void runRewrite(preset)}
                    disabled={isRewriting}
                    className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:border-border-strong hover:text-ink disabled:opacity-60"
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (instruction.trim()) void runRewrite(instruction.trim());
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={instruction}
                  onChange={(event) => setInstruction(event.target.value)}
                  placeholder="Or describe how…"
                  disabled={isRewriting}
                  className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={isRewriting || !instruction.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-surface transition-colors hover:bg-accent-hover disabled:opacity-60"
                >
                  {isRewriting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Go"}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="rounded-lg bg-surface px-3 py-2 text-sm text-ink">
                {rewritePreview || (
                  <span className="inline-flex items-center gap-2 text-ink-faint">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Rewriting…
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyRewrite}
                  disabled={isRewriting}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-surface transition-colors hover:bg-accent-hover disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => setRewritePreview(null)}
                  disabled={isRewriting}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink disabled:opacity-60"
                >
                  Try again
                </button>
                <button
                  type="button"
                  onClick={closePanel}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-soft hover:text-ink"
                >
                  Discard
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
