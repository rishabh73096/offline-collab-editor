import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WebSocket as NodeWebSocket } from "ws";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import type { Role } from "@prisma/client";
import { createCollabServer, type CollabServerHandle } from "../../../server/createCollabServer";
import { createInMemoryPersistence } from "../../../server/persistence";
import { signCollabToken } from "../../../lib/auth/collabToken";

process.env.COLLAB_JWT_SECRET = "test-collab-secret-at-least-32-bytes-long-xx";
const INTERNAL_SECRET = "test-internal-secret-at-least-32-bytes-xxxx";
process.env.COLLAB_INTERNAL_SECRET = INTERNAL_SECRET;

let handle: CollabServerHandle;
let wsBaseUrl: string;
let httpBaseUrl: string;

beforeAll(async () => {
  handle = createCollabServer(createInMemoryPersistence());
  await new Promise<void>((resolve) => handle.httpServer.listen(0, resolve));
  const address = handle.httpServer.address() as AddressInfo;
  wsBaseUrl = `ws://127.0.0.1:${address.port}`;
  httpBaseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await handle.close();
});

function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (predicate()) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        reject(new Error("waitFor timed out"));
      }
    }, 20);
  });
}

async function connectClient(documentId: string, userId: string, role: Role, ydoc: Y.Doc): Promise<WebsocketProvider> {
  const token = await signCollabToken({ userId, documentId, role });
  const provider = new WebsocketProvider(wsBaseUrl, documentId, ydoc, {
    params: { token },
    WebSocketPolyfill: NodeWebSocket as unknown as typeof WebSocket,
    disableBc: true,
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("initial sync timed out")), 5000);
    provider.on("sync", (isSynced: boolean) => {
      if (isSynced) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  return provider;
}

describe("collab server internal API (version history)", () => {
  it("rejects requests without the correct bearer secret", async () => {
    const documentId = `doc-${randomUUID()}`;
    const response = await fetch(`${httpBaseUrl}/internal/documents/${documentId}/state`);
    expect(response.status).toBe(401);

    const wrongSecret = await fetch(`${httpBaseUrl}/internal/documents/${documentId}/state`, {
      headers: { authorization: "Bearer not-the-secret" },
    });
    expect(wrongSecret.status).toBe(401);
  });

  it("rejects a restore body that isn't valid base64-state JSON", async () => {
    const documentId = `doc-${randomUUID()}`;
    const response = await fetch(`${httpBaseUrl}/internal/documents/${documentId}/restore`, {
      method: "POST",
      headers: { authorization: `Bearer ${INTERNAL_SECRET}`, "content-type": "application/json" },
      body: JSON.stringify({ notState: true }),
    });
    expect(response.status).toBe(400);
  });

  it("restores content and broadcasts it to a live connected collaborator instead of corrupting their session", async () => {
    const documentId = `doc-${randomUUID()}`;
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    const providerA = await connectClient(documentId, "user-a", "OWNER", docA);
    const providerB = await connectClient(documentId, "user-b", "EDITOR", docB);

    // Capture "the original" the way the Next.js API route would: read the
    // live state back out via the same internal endpoint used for version
    // capture, after seeding some content.
    docA.getText("content").insert(0, "the original text");
    await waitFor(() => docB.getText("content").toString() === "the original text");

    const stateResponse = await fetch(`${httpBaseUrl}/internal/documents/${documentId}/state`, {
      headers: { authorization: `Bearer ${INTERNAL_SECRET}` },
    });
    expect(stateResponse.status).toBe(200);
    const { state: capturedState } = (await stateResponse.json()) as { state: string };

    // Both collaborators now diverge from the captured snapshot.
    docA.getText("content").insert(0, "A's edit — ");
    docB.getText("content").insert("A's edit — the original text".length, " — B's edit too");
    await waitFor(() => docA.getText("content").toString() === docB.getText("content").toString());
    expect(docA.getText("content").toString()).not.toBe("the original text");

    // Restore, exactly as the versions API route would call it.
    const restoreResponse = await fetch(`${httpBaseUrl}/internal/documents/${documentId}/restore`, {
      method: "POST",
      headers: { authorization: `Bearer ${INTERNAL_SECRET}`, "content-type": "application/json" },
      body: JSON.stringify({ state: capturedState }),
    });
    expect(restoreResponse.status).toBe(200);
    const { state: resultingState } = (await restoreResponse.json()) as { state: string };
    expect(typeof resultingState).toBe("string");

    // Both live collaborators converge back to the restored content — the
    // whole point: restoring doesn't silently overwrite/corrupt a session
    // another active collaborator is looking at, it arrives as a normal,
    // real-time, causally-ordered edit through the exact same broadcast
    // path any other change takes.
    await waitFor(() => docA.getText("content").toString() === "the original text");
    await waitFor(() => docB.getText("content").toString() === "the original text");

    providerA.destroy();
    providerB.destroy();
  });

  it("still applies a restore to a document with no active connections", async () => {
    const documentId = `doc-${randomUUID()}`;
    const seedDoc = new Y.Doc();
    const seedProvider = await connectClient(documentId, "seed-user", "OWNER", seedDoc);
    seedDoc.getText("content").insert(0, "snapshot content");
    await waitFor(() => seedDoc.getText("content").toString() === "snapshot content");

    const stateResponse = await fetch(`${httpBaseUrl}/internal/documents/${documentId}/state`, {
      headers: { authorization: `Bearer ${INTERNAL_SECRET}` },
    });
    const { state: capturedState } = (await stateResponse.json()) as { state: string };
    seedProvider.destroy();

    // No one connected right now — restore should still succeed by
    // hydrating the room fresh (from persistence) and applying the diff.
    const restoreResponse = await fetch(`${httpBaseUrl}/internal/documents/${documentId}/restore`, {
      method: "POST",
      headers: { authorization: `Bearer ${INTERNAL_SECRET}`, "content-type": "application/json" },
      body: JSON.stringify({ state: capturedState }),
    });
    expect(restoreResponse.status).toBe(200);

    const laterDoc = new Y.Doc();
    const laterProvider = await connectClient(documentId, "later-user", "VIEWER", laterDoc);
    expect(laterDoc.getText("content").toString()).toBe("snapshot content");
    laterProvider.destroy();
  });
});
