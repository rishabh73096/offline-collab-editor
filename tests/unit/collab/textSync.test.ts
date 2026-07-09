import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { applyTextareaEdit } from "@/lib/collab/textSync";

function makeText(initial = "") {
  const doc = new Y.Doc();
  const ytext = doc.getText("content");
  if (initial) {
    ytext.insert(0, initial);
  }
  return ytext;
}

describe("applyTextareaEdit", () => {
  it("does nothing when values are identical", () => {
    const ytext = makeText("hello");
    let updateCount = 0;
    ytext.doc?.on("update", () => {
      updateCount++;
    });

    applyTextareaEdit(ytext, "hello", "hello");

    expect(updateCount).toBe(0);
  });

  it("applies a pure insertion", () => {
    const ytext = makeText("hello world");
    applyTextareaEdit(ytext, "hello world", "hello, world");
    expect(ytext.toString()).toBe("hello, world");
  });

  it("applies a pure deletion", () => {
    const ytext = makeText("hello world");
    applyTextareaEdit(ytext, "hello world", "hello");
    expect(ytext.toString()).toBe("hello");
  });

  it("applies a replacement in the middle", () => {
    const ytext = makeText("the quick brown fox");
    applyTextareaEdit(ytext, "the quick brown fox", "the slow brown fox");
    expect(ytext.toString()).toBe("the slow brown fox");
  });

  it("clears all content", () => {
    const ytext = makeText("some content");
    applyTextareaEdit(ytext, "some content", "");
    expect(ytext.toString()).toBe("");
  });

  it("types into an empty document", () => {
    const ytext = makeText("");
    applyTextareaEdit(ytext, "", "a");
    expect(ytext.toString()).toBe("a");
  });

  it("produces a minimal insert-only diff for an append, not a full replace", () => {
    const ytext = makeText("hello");
    const ops: Array<{ insert?: string; delete?: number }> = [];
    ytext.observe((event) => {
      for (const entry of event.delta) {
        if (typeof entry.insert === "string") ops.push({ insert: entry.insert });
        if (typeof entry.delete === "number") ops.push({ delete: entry.delete });
      }
    });

    applyTextareaEdit(ytext, "hello", "hello world");

    expect(ops.some((op) => op.delete)).toBe(false);
    expect(ops.find((op) => op.insert)?.insert).toBe(" world");
  });

  it("round-trips a sequence of edits like real typing", () => {
    const ytext = makeText("");
    const sequence = ["h", "he", "hel", "hell", "hello", "hello ", "hello w", "hello wo"];
    let previous = "";
    for (const next of sequence) {
      applyTextareaEdit(ytext, previous, next);
      expect(ytext.toString()).toBe(next);
      previous = next;
    }
  });
});
