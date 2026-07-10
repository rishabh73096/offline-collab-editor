import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import {
  messageSync,
  messageAwareness,
  encodeSyncStep1,
  encodeUpdateMessage,
  encodeAwarenessMessage,
  decodeMessage,
  syncProtocol,
  decoding,
} from "@/lib/sync/protocol";

describe("wire protocol envelope", () => {
  it("encodes a sync step 1 message with the sync outer type", () => {
    const doc = new Y.Doc();
    const bytes = encodeSyncStep1(doc);
    const { outerType, decoder } = decodeMessage(bytes);

    expect(outerType).toBe(messageSync);
    expect(decoding.readVarUint(decoder)).toBe(syncProtocol.messageYjsSyncStep1);
  });

  it("round-trips an update message and applies it to a second doc", () => {
    const source = new Y.Doc();
    source.getText("content").insert(0, "hello");
    const update = Y.encodeStateAsUpdate(source);

    const bytes = encodeUpdateMessage(update);
    const { outerType, decoder } = decodeMessage(bytes);
    expect(outerType).toBe(messageSync);

    const target = new Y.Doc();
    const syncMessageType = decoding.readVarUint(decoder);
    expect(syncMessageType).toBe(syncProtocol.messageYjsUpdate);
    syncProtocol.readUpdate(decoder, target, "test");

    expect(target.getText("content").toString()).toBe("hello");
  });

  it("round-trips an awareness message", () => {
    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);
    awareness.setLocalState({ name: "test-user" });

    const update = awarenessProtocol.encodeAwarenessUpdate(awareness, [doc.clientID]);
    const bytes = encodeAwarenessMessage(update);
    const { outerType, decoder } = decodeMessage(bytes);

    expect(outerType).toBe(messageAwareness);

    const receivingDoc = new Y.Doc();
    const receivingAwareness = new awarenessProtocol.Awareness(receivingDoc);
    awarenessProtocol.applyAwarenessUpdate(receivingAwareness, decoding.readVarUint8Array(decoder), "test");

    expect(receivingAwareness.getStates().get(doc.clientID)).toEqual({ name: "test-user" });
  });
});
