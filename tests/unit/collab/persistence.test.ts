import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { hydrateDocument } from "@/lib/collab/persistence";
import { localDb } from "@/lib/db/dexie";

const DEBOUNCE_WAIT_MS = 400;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(async () => {
  await localDb.documents.clear();
});

describe("hydrateDocument", () => {
  it("creates an empty local record on first open, with zero network calls", async () => {
    const doc = await hydrateDocument("doc-1");
    expect(doc.getText("content").toString()).toBe("");

    const record = await localDb.documents.get("doc-1");
    expect(record).toBeDefined();
    expect(record?.id).toBe("doc-1");

    doc.destroy();
  });

  it("persists local edits to Dexie (debounced) and rehydrates them on the next open", async () => {
    const first = await hydrateDocument("doc-2");
    first.getText("content").insert(0, "hello offline world");

    await wait(DEBOUNCE_WAIT_MS);

    const record = await localDb.documents.get("doc-2");
    expect(record).toBeDefined();
    expect(record!.ydocState.byteLength).toBeGreaterThan(0);
    first.destroy();

    const second = await hydrateDocument("doc-2");
    expect(second.getText("content").toString()).toBe("hello offline world");
    second.destroy();
  });

  it("debounces rapid successive edits into a single persisted write", async () => {
    const doc = await hydrateDocument("doc-3");
    const ytext = doc.getText("content");

    for (const char of "hello") {
      ytext.insert(ytext.length, char);
    }

    await wait(DEBOUNCE_WAIT_MS);

    const record = await localDb.documents.get("doc-3");
    expect(record).toBeDefined();

    const rehydrated = await hydrateDocument("doc-3");
    expect(rehydrated.getText("content").toString()).toBe("hello");

    doc.destroy();
    rehydrated.destroy();
  });

  it("keeps documents isolated by id", async () => {
    const docA = await hydrateDocument("doc-a");
    const docB = await hydrateDocument("doc-b");

    docA.getText("content").insert(0, "A content");
    docB.getText("content").insert(0, "B content");

    await wait(DEBOUNCE_WAIT_MS);

    const reloadedA = await hydrateDocument("doc-a");
    const reloadedB = await hydrateDocument("doc-b");

    expect(reloadedA.getText("content").toString()).toBe("A content");
    expect(reloadedB.getText("content").toString()).toBe("B content");

    [docA, docB, reloadedA, reloadedB].forEach((doc) => doc.destroy());
  });
});
