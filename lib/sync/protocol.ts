import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as syncProtocol from "y-protocols/sync";
import type * as Y from "yjs";

/**
 * Wire protocol shared by the client sync engine (lib/sync/engine.ts) and
 * the collab server (server/connection.ts). Every WebSocket message is
 * [outer messageType: varUint, ...payload]. Outer type 0 wraps the Yjs sync
 * sub-protocol (see y-protocols/sync); outer type 1 wraps an awareness
 * update. Keeping the envelope helpers here means both sides agree on the
 * exact same byte layout without duplicating the encoding logic.
 */
export const messageSync = 0;
export const messageAwareness = 1;

export function encodeSyncStep1(doc: Y.Doc): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeSyncStep1(encoder, doc);
  return encoding.toUint8Array(encoder);
}

export function encodeUpdateMessage(update: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageSync);
  syncProtocol.writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

export function encodeAwarenessMessage(awarenessUpdate: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, messageAwareness);
  encoding.writeVarUint8Array(encoder, awarenessUpdate);
  return encoding.toUint8Array(encoder);
}

export function decodeMessage(data: Uint8Array): {
  outerType: number;
  decoder: decoding.Decoder;
} {
  const decoder = decoding.createDecoder(data);
  const outerType = decoding.readVarUint(decoder);
  return { outerType, decoder };
}

export { syncProtocol, encoding, decoding };
