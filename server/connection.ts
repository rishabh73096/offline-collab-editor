import type WebSocket from "ws";
import type * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import type { Role } from "@prisma/client";
import {
  messageSync,
  messageAwareness,
  encodeSyncStep1,
  encodeAwarenessMessage,
  decodeMessage,
  syncProtocol,
  encoding,
  decoding,
} from "../lib/sync/protocol";
import type { RoomRegistry, RoomConnection } from "./roomRegistry";

export interface ConnectionContext {
  documentId: string;
  userId: string;
  role: Role;
}

function canWrite(role: Role): boolean {
  return role === "OWNER" || role === "EDITOR";
}

/**
 * Wires one authenticated WebSocket connection into its document's room:
 * sends the initial sync/awareness handshake, applies inbound messages
 * (dropping any state-mutating message from a Viewer instead of applying
 * it), and tears the connection out of the room on close. Any decode or
 * apply error closes just this socket — never the process.
 */
export async function handleConnection(
  ws: WebSocket,
  ctx: ConnectionContext,
  registry: RoomRegistry,
): Promise<void> {
  // registry.getOrCreateRoom awaits a real persistence read (Postgres, in
  // production), which can easily take longer than the round-trip for the
  // client's own initial handshake message sent immediately on open. A
  // message listener attached only after that await would silently miss
  // it — WebSocket 'message' events aren't buffered for late listeners.
  // So: attach a queueing listener synchronously first, then replay
  // whatever arrived once the room (and the real listener) is ready.
  const pending: Uint8Array[] = [];
  const queue = (raw: Buffer | ArrayBuffer | Buffer[]) => pending.push(toUint8Array(raw));
  ws.on("message", queue);

  const room = await registry.getOrCreateRoom(ctx.documentId);

  const conn: RoomConnection = {
    userId: ctx.userId,
    role: ctx.role,
    awarenessClientIds: new Set(),
    send: (data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    },
  };

  room.connections.add(conn);

  conn.send(encodeSyncStep1(room.ydoc));

  const awarenessStates = room.awareness.getStates();
  if (awarenessStates.size > 0) {
    conn.send(encodeAwarenessMessage(awarenessProtocol.encodeAwarenessUpdate(room.awareness, Array.from(awarenessStates.keys()))));
  }

  const processMessage = (data: Uint8Array) => {
    try {
      const { outerType, decoder } = decodeMessage(data);

      if (outerType === messageSync) {
        handleSyncMessage(decoder, room.ydoc, conn);
      } else if (outerType === messageAwareness) {
        const update = decoding.readVarUint8Array(decoder);
        awarenessProtocol.applyAwarenessUpdate(room.awareness, update, conn);
      }
    } catch (error) {
      console.error(`[collab] malformed message from user=${ctx.userId} doc=${ctx.documentId}; closing connection`, error);
      ws.close(1003, "Malformed message");
    }
  };

  ws.off("message", queue);
  for (const data of pending) {
    processMessage(data);
  }
  ws.on("message", (raw: Buffer | ArrayBuffer | Buffer[]) => processMessage(toUint8Array(raw)));

  const cleanup = () => registry.removeConnection(ctx.documentId, conn);
  ws.on("close", cleanup);
  ws.on("error", cleanup);
}

function handleSyncMessage(decoder: decoding.Decoder, ydoc: Y.Doc, conn: RoomConnection) {
  const syncMessageType = decoding.readVarUint(decoder);

  switch (syncMessageType) {
    case syncProtocol.messageYjsSyncStep1: {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.readSyncStep1(decoder, encoder, ydoc);
      conn.send(encoding.toUint8Array(encoder));
      break;
    }
    case syncProtocol.messageYjsSyncStep2:
      if (canWrite(conn.role)) {
        syncProtocol.readSyncStep2(decoder, ydoc, conn, rethrow);
      }
      break;
    case syncProtocol.messageYjsUpdate:
      if (canWrite(conn.role)) {
        syncProtocol.readUpdate(decoder, ydoc, conn, rethrow);
      }
      break;
    default:
      throw new Error(`Unknown sync message type: ${syncMessageType}`);
  }
}

/**
 * y-protocols' readSyncStep2/readUpdate catch their own Y.applyUpdate
 * errors internally and just log-and-continue by default. We want a
 * malformed doc-level update to close the offending connection like any
 * other decode failure, so this errorHandler rethrows — a throw from
 * inside their catch block propagates normally, out to our own try/catch
 * in the message handler above.
 */
function rethrow(error: Error): never {
  throw error;
}

function toUint8Array(raw: Buffer | ArrayBuffer | Buffer[]): Uint8Array {
  if (Array.isArray(raw)) {
    return new Uint8Array(Buffer.concat(raw));
  }
  if (raw instanceof ArrayBuffer) {
    return new Uint8Array(raw);
  }
  return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
}
