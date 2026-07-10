"use client";

import { useEffect, useState } from "react";
import type * as Y from "yjs";
import { hydrateDocument } from "@/lib/collab/persistence";
import { startSyncEngine, type SyncEngine } from "@/lib/sync/engine";

interface UseDocumentResult {
  ytext: Y.Text | null;
  isReady: boolean;
}

interface LoadedDocument {
  docId: string;
  ytext: Y.Text;
}

/**
 * Loads a document's Y.Doc from local storage (Dexie/IndexedDB) for the
 * given docId. Resolves as soon as the local copy is hydrated — never waits
 * on the network — so the editor can render and accept input immediately.
 * The realtime collab connection (lib/sync/engine.ts) is started afterward,
 * in the background, and never blocks readiness.
 */
export function useDocument(docId: string): UseDocumentResult {
  const [loaded, setLoaded] = useState<LoadedDocument | null>(null);

  useEffect(() => {
    let cancelled = false;
    let doc: Y.Doc | null = null;
    let syncEngine: SyncEngine | null = null;

    hydrateDocument(docId).then((hydrated) => {
      if (cancelled) {
        hydrated.destroy();
        return;
      }
      doc = hydrated;
      setLoaded({ docId, ytext: hydrated.getText("content") });

      void startSyncEngine(docId, hydrated).then((engine) => {
        if (cancelled) {
          engine?.disconnect();
          return;
        }
        syncEngine = engine;
      });
    });

    return () => {
      cancelled = true;
      syncEngine?.disconnect();
      doc?.destroy();
    };
  }, [docId]);

  const isReady = loaded?.docId === docId;

  return { ytext: isReady ? loaded.ytext : null, isReady };
}
