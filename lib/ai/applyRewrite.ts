import type * as Y from "yjs";
import { applyTextareaEdit } from "@/lib/collab/textSync";

export class StaleSelectionError extends Error {}

/**
 * Applies an AI rewrite result back into the live document at the
 * originally-selected range. Streaming a rewrite takes a few seconds, during
 * which the exact selected range could have changed — someone else editing
 * live, or the same user typing elsewhere. Re-checks the current content at
 * those offsets still matches what was originally selected before applying,
 * rather than blindly splicing at offsets that may no longer mean anything.
 */
export function applyRewriteResult(
  ytext: Y.Text,
  selectionStart: number,
  originalSelectedText: string,
  rewrittenText: string,
): void {
  const current = ytext.toString();
  const currentSelected = current.slice(selectionStart, selectionStart + originalSelectedText.length);

  if (currentSelected !== originalSelectedText) {
    throw new StaleSelectionError("The selected text changed before the rewrite finished");
  }

  const newValue =
    current.slice(0, selectionStart) + rewrittenText + current.slice(selectionStart + originalSelectedText.length);

  applyTextareaEdit(ytext, current, newValue);
}
