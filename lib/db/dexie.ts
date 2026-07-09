import Dexie, { type Table } from "dexie";

/**
 * The client's primary source of truth. `ydocState` is a full Yjs binary
 * snapshot (Y.encodeStateAsUpdate) — opening a document reads this table
 * only, with zero network requests in the critical path.
 */
export interface LocalDocumentRecord {
  id: string;
  ydocState: Uint8Array;
  updatedAt: number;
}

class LocalDatabase extends Dexie {
  documents!: Table<LocalDocumentRecord, string>;

  constructor() {
    super("offline-collab-editor");
    this.version(1).stores({
      documents: "id, updatedAt",
    });
  }
}

export const localDb = new LocalDatabase();
