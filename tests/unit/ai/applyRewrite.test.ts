import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { applyRewriteResult, StaleSelectionError } from "@/lib/ai/applyRewrite";

function makeText(initial: string) {
  const doc = new Y.Doc();
  const ytext = doc.getText("content");
  ytext.insert(0, initial);
  return ytext;
}

describe("applyRewriteResult", () => {
  it("splices the rewrite into the document at the original selection", () => {
    const ytext = makeText("The quick brown fox jumps over the lazy dog.");
    applyRewriteResult(ytext, 4, "quick brown fox", "slow grey wolf");
    expect(ytext.toString()).toBe("The slow grey wolf jumps over the lazy dog.");
  });

  it("throws StaleSelectionError instead of corrupting content when the selected range changed", () => {
    const ytext = makeText("The quick brown fox jumps over the lazy dog.");
    // Someone (or the same user) edited the document after the selection was
    // captured but before the rewrite finished streaming back.
    ytext.delete(4, "quick".length);
    ytext.insert(4, "slow");

    expect(() => applyRewriteResult(ytext, 4, "quick brown fox", "anything")).toThrow(StaleSelectionError);
    // Nothing should have been applied.
    expect(ytext.toString()).toBe("The slow brown fox jumps over the lazy dog.");
  });

  it("produces a minimal diff (not a full-document replace) so concurrent edits elsewhere survive", () => {
    const ytext = makeText("Keep this. quick brown fox. Keep this too.");
    const deleteLengths: number[] = [];
    ytext.observe((event) => {
      event.delta.forEach((entry) => {
        if (typeof entry.delete === "number") {
          deleteLengths.push(entry.delete);
        }
      });
    });

    applyRewriteResult(ytext, "Keep this. ".length, "quick brown fox", "swift grey wolf");

    expect(ytext.toString()).toBe("Keep this. swift grey wolf. Keep this too.");
    // A correct minimal diff never needs to delete more than the selection
    // itself — the trailing "too." text should never be touched.
    const deletedSomethingBeyondTheSelection = deleteLengths.some((length) => length > "quick brown fox".length);
    expect(deletedSomethingBeyondTheSelection).toBe(false);
  });
});
