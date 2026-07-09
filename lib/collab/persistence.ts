import * as Y from "yjs";
import { localDb } from "@/lib/db/dexie";

const PERSIST_DEBOUNCE_MS = 300;

/**
 * Loads (or creates) the local Y.Doc for a document from Dexie/IndexedDB and
 * wires up debounced persistence for future edits. This is the only thing
 * that runs when a document is opened — no network request is made or
 * awaited here, so editing works immediately even fully offline.
 */
export async function hydrateDocument(docId: string): Promise<Y.Doc> {
  const ydoc = new Y.Doc();
  const record = await localDb.documents.get(docId);

  if (record) {
    Y.applyUpdate(ydoc, record.ydocState, "local-hydrate");
  } else {
    await localDb.documents.put({
      id: docId,
      ydocState: Y.encodeStateAsUpdate(ydoc),
      updatedAt: Date.now(),
    });
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  ydoc.on("update", () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      void localDb.documents.put({
        id: docId,
        ydocState: Y.encodeStateAsUpdate(ydoc),
        updatedAt: Date.now(),
      });
    }, PERSIST_DEBOUNCE_MS);
  });

  return ydoc;
}
