import * as Y from "yjs";
import { Awareness, removeAwarenessStates, encodeAwarenessUpdate } from "y-protocols/awareness";
import type { Role } from "@prisma/client";
import { encodeUpdateMessage, encodeAwarenessMessage } from "../lib/sync/protocol";
import type { DocumentPersistence } from "./persistence";

const PERSIST_DEBOUNCE_MS = 2000;

export interface RoomConnection {
  userId: string;
  role: Role;
  awarenessClientIds: Set<number>;
  send: (data: Uint8Array) => void;
}

export interface Room {
  ydoc: Y.Doc;
  awareness: Awareness;
  connections: Set<RoomConnection>;
  persistTimer: ReturnType<typeof setTimeout> | null;
}

/**
 * Holds one in-memory Y.Doc + Awareness instance per actively-connected
 * document ("room"), broadcasting updates between connections and
 * debouncing writes back to persistent storage. A document with no open
 * connections is not held in memory.
 */
export class RoomRegistry {
  private rooms = new Map<string, Room>();

  constructor(private persistence: DocumentPersistence) {}

  async getOrCreateRoom(documentId: string): Promise<Room> {
    const existing = this.rooms.get(documentId);
    if (existing) {
      return existing;
    }

    const ydoc = new Y.Doc();
    const state = await this.loadWithRetry(documentId);
    if (state) {
      Y.applyUpdate(ydoc, state, "persistence-load");
    }

    const room: Room = {
      ydoc,
      awareness: new Awareness(ydoc),
      connections: new Set(),
      persistTimer: null,
    };

    ydoc.on("update", (update: Uint8Array, origin: unknown) => {
      const message = encodeUpdateMessage(update);
      for (const conn of room.connections) {
        if (conn !== origin) {
          conn.send(message);
        }
      }
      this.schedulePersist(documentId, room);
    });

    room.awareness.on(
      "update",
      (
        { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown,
      ) => {
        const changedClientIds = added.concat(updated, removed);
        const message = encodeAwarenessMessage(encodeAwarenessUpdate(room.awareness, changedClientIds));
        for (const conn of room.connections) {
          if (conn !== origin) {
            conn.send(message);
          }
        }

        if (isRoomConnection(origin)) {
          for (const id of added.concat(updated)) {
            origin.awarenessClientIds.add(id);
          }
          for (const id of removed) {
            origin.awarenessClientIds.delete(id);
          }
        }
      },
    );

    this.rooms.set(documentId, room);
    return room;
  }

  removeConnection(documentId: string, conn: RoomConnection) {
    const room = this.rooms.get(documentId);
    if (!room) {
      return;
    }

    room.connections.delete(conn);
    if (conn.awarenessClientIds.size > 0) {
      removeAwarenessStates(room.awareness, Array.from(conn.awarenessClientIds), "connection-closed");
    }

    if (room.connections.size === 0) {
      this.evictRoom(documentId, room);
    }
  }

  private schedulePersist(documentId: string, room: Room) {
    if (room.persistTimer) {
      clearTimeout(room.persistTimer);
    }
    room.persistTimer = setTimeout(() => {
      room.persistTimer = null;
      void this.persistSafely(documentId, room);
    }, PERSIST_DEBOUNCE_MS);
  }

  private evictRoom(documentId: string, room: Room) {
    if (room.persistTimer) {
      clearTimeout(room.persistTimer);
      room.persistTimer = null;
    }
    void this.persistSafely(documentId, room).finally(() => {
      const current = this.rooms.get(documentId);
      if (current === room && current.connections.size === 0) {
        this.rooms.delete(documentId);
      }
    });
  }

  /**
   * Neon (and serverless Postgres generally) can suspend its compute after
   * idle time and forcibly terminate open connections (SQLSTATE 57P01).
   * A `save`/`load` racing that termination would otherwise become an
   * unhandled promise rejection — fatal for this long-running process by
   * default in Node — taking down every connected room, not just this one.
   * One retry covers the common case (Prisma reconnects transparently on
   * the next query); if it still fails we log and move on, since the room
   * stays correct in memory and the next debounced edit will try again.
   */
  private async loadWithRetry(documentId: string): Promise<Uint8Array | null> {
    try {
      return await this.persistence.load(documentId);
    } catch (error) {
      console.error(`[collab] load failed for doc=${documentId}, retrying once`, error);
      return this.persistence.load(documentId);
    }
  }

  private async persistSafely(documentId: string, room: Room): Promise<void> {
    const state = Y.encodeStateAsUpdate(room.ydoc);
    try {
      await this.persistence.save(documentId, state);
    } catch (error) {
      console.error(`[collab] save failed for doc=${documentId}, retrying once`, error);
      try {
        await this.persistence.save(documentId, state);
      } catch (retryError) {
        console.error(
          `[collab] save retry also failed for doc=${documentId}; in-memory state is unaffected, next edit will retry`,
          retryError,
        );
      }
    }
  }
}

function isRoomConnection(value: unknown): value is RoomConnection {
  return typeof value === "object" && value !== null && "awarenessClientIds" in value;
}
