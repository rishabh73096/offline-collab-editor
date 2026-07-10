import { describe, it, expect, vi } from "vitest";
import * as Y from "yjs";
import { RoomRegistry } from "../../../server/roomRegistry";
import type { DocumentPersistence } from "../../../server/persistence";

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("RoomRegistry resilience to a flaky database", () => {
  it("recovers a room after the first load attempt fails (simulating a dropped Neon connection)", async () => {
    let calls = 0;
    const persistence: DocumentPersistence = {
      load: vi.fn(async () => {
        calls++;
        if (calls === 1) {
          throw new Error("terminating connection due to administrator command");
        }
        return null;
      }),
      save: vi.fn(async () => {}),
    };

    const registry = new RoomRegistry(persistence);
    const room = await registry.getOrCreateRoom("doc-1");

    expect(room.ydoc).toBeInstanceOf(Y.Doc);
    expect(persistence.load).toHaveBeenCalledTimes(2);
  });

  it("propagates a load failure when both the initial attempt and the retry fail", async () => {
    const persistence: DocumentPersistence = {
      load: vi.fn(async () => {
        throw new Error("connection terminated");
      }),
      save: vi.fn(async () => {}),
    };

    const registry = new RoomRegistry(persistence);
    await expect(registry.getOrCreateRoom("doc-2")).rejects.toThrow("connection terminated");
    expect(persistence.load).toHaveBeenCalledTimes(2);
  });

  it("does not throw out of the debounced persist path when save keeps failing", async () => {
    const persistence: DocumentPersistence = {
      load: vi.fn(async () => null),
      save: vi.fn(async () => {
        throw new Error("terminating connection due to administrator command");
      }),
    };

    const registry = new RoomRegistry(persistence);
    const room = await registry.getOrCreateRoom("doc-3");

    // Triggers the debounced persist path; if save's rejection weren't
    // caught internally, this would surface as an unhandled rejection in
    // this test process (Vitest fails the run on those) rather than a
    // clean assertion failure.
    room.ydoc.getText("content").insert(0, "hello");

    await wait(2500);
    expect(persistence.save).toHaveBeenCalledTimes(2); // initial attempt + one retry
  });
});
