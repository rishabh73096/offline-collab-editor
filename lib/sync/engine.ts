import { WebsocketProvider } from "y-websocket";
import { Awareness } from "y-protocols/awareness";
import type * as Y from "yjs";
import { fetchCollabToken } from "@/lib/api/collabToken";
import { useSyncStore } from "@/lib/store/syncStore";

const TOKEN_REFRESH_INTERVAL_MS = 45_000;

export interface SyncEngine {
  awareness: Awareness;
  disconnect: () => void;
}

/**
 * Connects a locally-hydrated Y.Doc to the collab server in the background.
 * Never awaited by the editor's render path — this is purely additive on
 * top of the local-first storage from Module 3. If no WS URL is configured,
 * or the initial token fetch fails, the document simply stays local-only.
 *
 * The collab token is short-lived (60s), so it's refreshed on an interval
 * independent of connection attempts: y-websocket's WebsocketProvider reads
 * `provider.params` fresh on every (re)connect, so updating it here is
 * picked up automatically by its own built-in reconnect/backoff loop.
 */
export async function startSyncEngine(documentId: string, ydoc: Y.Doc): Promise<SyncEngine | null> {
  const wsBaseUrl = process.env.NEXT_PUBLIC_COLLAB_WS_URL;
  if (!wsBaseUrl) {
    return null;
  }

  const setStatus = useSyncStore.getState().setStatus;

  let token: string;
  try {
    token = await fetchCollabToken(documentId);
  } catch {
    setStatus("error");
    return null;
  }

  const awareness = new Awareness(ydoc);
  const provider = new WebsocketProvider(wsBaseUrl, documentId, ydoc, {
    awareness,
    params: { token },
  });

  provider.on("status", ({ status }: { status: "connected" | "disconnected" | "connecting" }) => {
    if (status === "connecting") {
      setStatus("connecting");
    } else if (status === "connected") {
      setStatus(provider.synced ? "synced" : "syncing");
    } else {
      setStatus("offline");
    }
  });

  provider.on("sync", (isSynced: boolean) => {
    setStatus(isSynced ? "synced" : "syncing");
  });

  provider.on("connection-error", () => {
    setStatus("error");
  });

  const refreshToken = () => {
    fetchCollabToken(documentId)
      .then((freshToken) => {
        provider.params = { token: freshToken };
      })
      .catch(() => {
        // Keep using the last known token; the next tick (or the caller
        // reconnecting) will retry.
      });
  };
  const refreshTimer = setInterval(refreshToken, TOKEN_REFRESH_INTERVAL_MS);

  const handleOnline = () => provider.connect();
  const handleOffline = () => setStatus("offline");
  if (typeof window !== "undefined") {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  }

  return {
    awareness,
    disconnect: () => {
      clearInterval(refreshTimer);
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
      provider.destroy();
      awareness.destroy();
      setStatus("offline");
    },
  };
}
