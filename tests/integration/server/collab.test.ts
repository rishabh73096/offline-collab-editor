import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WebSocket as NodeWebSocket } from "ws";
import * as Y from "yjs";
import * as encoding from "lib0/encoding";
import { WebsocketProvider } from "y-websocket";
import type { Role } from "@prisma/client";
import { createCollabServer, type CollabServerHandle } from "../../../server/createCollabServer";
import { createInMemoryPersistence } from "../../../server/persistence";
import { signCollabToken } from "../../../lib/auth/collabToken";

process.env.COLLAB_JWT_SECRET = "test-collab-secret-at-least-32-bytes-long-xx";

let handle: CollabServerHandle;
let baseUrl: string;

beforeAll(async () => {
  handle = createCollabServer(createInMemoryPersistence());
  await new Promise<void>((resolve) => handle.httpServer.listen(0, resolve));
  const address = handle.httpServer.address() as AddressInfo;
  baseUrl = `ws://127.0.0.1:${address.port}`;
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

async function connectClient(
  documentId: string,
  userId: string,
  role: Role,
  ydoc: Y.Doc,
  url = baseUrl,
): Promise<WebsocketProvider> {
  const token = await signCollabToken({ userId, documentId, role });
  const provider = new WebsocketProvider(url, documentId, ydoc, {
    params: { token },
    WebSocketPolyfill: NodeWebSocket as unknown as typeof WebSocket,
    // Both simulated "clients" run in this same Node process, so without
    // this, Node's global BroadcastChannel would sync them directly and
    // bypass the server (and its role gating) entirely.
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

describe("collab server", () => {
  it("converges concurrent edits from two different clients", async () => {
    const documentId = `doc-${randomUUID()}`;
    const docA = new Y.Doc();
    const docB = new Y.Doc();

    const providerA = await connectClient(documentId, "user-a", "OWNER", docA);
    const providerB = await connectClient(documentId, "user-b", "EDITOR", docB);

    docA.getText("content").insert(0, "Hello from A. ");
    docB.getText("content").insert(0, "Hello from B. ");

    await waitFor(() => docA.getText("content").toString() === docB.getText("content").toString());

    const finalText = docA.getText("content").toString();
    expect(finalText).toContain("Hello from A.");
    expect(finalText).toContain("Hello from B.");
    expect(docB.getText("content").toString()).toBe(finalText);

    providerA.destroy();
    providerB.destroy();
  });

  it("drops writes from a VIEWER connection instead of applying them", async () => {
    const documentId = `doc-${randomUUID()}`;
    const ownerDoc = new Y.Doc();
    const viewerDoc = new Y.Doc();

    const ownerProvider = await connectClient(documentId, "owner-1", "OWNER", ownerDoc);
    const viewerProvider = await connectClient(documentId, "viewer-1", "VIEWER", viewerDoc);

    viewerDoc.getText("content").insert(0, "viewer was here");
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(ownerDoc.getText("content").toString()).toBe("");

    ownerDoc.getText("content").insert(0, "owner content");
    await waitFor(() => viewerDoc.getText("content").toString().includes("owner content"));

    ownerProvider.destroy();
    viewerProvider.destroy();
  });

  it("closes an oversized raw message without crashing the server or other connections", async () => {
    const documentId = `doc-${randomUUID()}`;
    const survivorDoc = new Y.Doc();
    const survivorProvider = await connectClient(documentId, "survivor", "OWNER", survivorDoc);

    const token = await signCollabToken({ userId: "attacker", documentId, role: "OWNER" });
    const rawSocket = new NodeWebSocket(`${baseUrl}/${documentId}?token=${token}`);
    await new Promise<void>((resolve, reject) => {
      rawSocket.on("open", () => resolve());
      rawSocket.on("error", reject);
    });

    const closed = new Promise<void>((resolve) => rawSocket.on("close", () => resolve()));
    rawSocket.send(new Uint8Array(1024 * 1024)); // 1MB, over the server's 256KB cap
    await closed;

    survivorDoc.getText("content").insert(0, "still alive");
    await waitFor(() => survivorDoc.getText("content").toString() === "still alive");

    survivorProvider.destroy();
  });

  it("closes only the offending connection on a malformed sync message", async () => {
    const documentId = `doc-${randomUUID()}`;
    const goodDoc = new Y.Doc();
    const goodProvider = await connectClient(documentId, "good-user", "OWNER", goodDoc);

    const token = await signCollabToken({ userId: "bad-user", documentId, role: "OWNER" });
    const badSocket = new NodeWebSocket(`${baseUrl}/${documentId}?token=${token}`);
    await new Promise<void>((resolve, reject) => {
      badSocket.on("open", () => resolve());
      badSocket.on("error", reject);
    });

    // A sync/syncStep2 message that claims a payload far larger than what
    // actually follows it — lib0's decoder throws reading past the buffer.
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0); // outer: messageSync
    encoding.writeVarUint(encoder, 1); // inner: messageYjsSyncStep2
    encoding.writeVarUint(encoder, 999_999); // claimed array length, no data follows
    const malformed = encoding.toUint8Array(encoder);

    const closed = new Promise<void>((resolve) => badSocket.on("close", () => resolve()));
    badSocket.send(malformed);
    await closed;

    goodDoc.getText("content").insert(0, "server still fine");
    await waitFor(() => goodDoc.getText("content").toString() === "server still fine");

    goodProvider.destroy();
  });

  it("rejects a connection whose token documentId does not match the URL", async () => {
    const documentId = `doc-${randomUUID()}`;
    const otherDocumentId = `doc-${randomUUID()}`;
    const token = await signCollabToken({ userId: "mismatched-user", documentId: otherDocumentId, role: "OWNER" });

    const socket = new NodeWebSocket(`${baseUrl}/${documentId}?token=${token}`);
    const result = await new Promise<"open" | "error-or-close">((resolve) => {
      socket.on("open", () => resolve("open"));
      socket.on("error", () => resolve("error-or-close"));
      socket.on("unexpected-response", () => resolve("error-or-close"));
    });

    expect(result).toBe("error-or-close");
  });

  describe("with slow persistence (simulating a real database round-trip)", () => {
    let slowHandle: CollabServerHandle;
    let slowBaseUrl: string;

    beforeAll(async () => {
      // A fast in-memory load() resolves before a client's own initial
      // handshake message could possibly arrive, which previously masked a
      // real bug: the message listener was attached only after awaiting
      // room setup, silently dropping that message against a real database
      // (Postgres round-trip) where the delay is large enough to lose the
      // race. This 150ms delay reproduces that window deterministically.
      slowHandle = createCollabServer(createInMemoryPersistence(150));
      await new Promise<void>((resolve) => slowHandle.httpServer.listen(0, resolve));
      const address = slowHandle.httpServer.address() as AddressInfo;
      slowBaseUrl = `ws://127.0.0.1:${address.port}`;
    });

    afterAll(async () => {
      await slowHandle.close();
    });

    it("does not drop the client's initial handshake message while the room is still loading", async () => {
      const documentId = `doc-${randomUUID()}`;
      const ydoc = new Y.Doc();

      // connectClient resolves only once the client's "sync" event fires,
      // which requires the server to have received and replied to the
      // client's own syncStep1 — exactly the message that was previously
      // getting lost during slow room setup.
      const provider = await connectClient(documentId, "slow-user", "OWNER", ydoc, slowBaseUrl);

      expect(provider.synced).toBe(true);
      provider.destroy();
    });
  });

  describe("with a persistently failing database", () => {
    let brokenHandle: CollabServerHandle;
    let brokenBaseUrl: string;

    beforeAll(async () => {
      // Simulates Neon (or any Postgres) refusing every query, e.g. its
      // compute is suspended and won't wake up in time. The server must
      // close the affected connection cleanly rather than hang forever or
      // let the failure become an unhandled rejection that crashes every
      // other room on the same process.
      const alwaysFails = {
        load: () => Promise.reject(new Error("terminating connection due to administrator command")),
        save: () => Promise.reject(new Error("terminating connection due to administrator command")),
      };
      brokenHandle = createCollabServer(alwaysFails);
      await new Promise<void>((resolve) => brokenHandle.httpServer.listen(0, resolve));
      const address = brokenHandle.httpServer.address() as AddressInfo;
      brokenBaseUrl = `ws://127.0.0.1:${address.port}`;
    });

    afterAll(async () => {
      await brokenHandle.close();
    });

    it("closes the connection instead of hanging or crashing the server", async () => {
      const documentId = `doc-${randomUUID()}`;
      const token = await signCollabToken({ userId: "unlucky-user", documentId, role: "OWNER" });
      const socket = new NodeWebSocket(`${brokenBaseUrl}/${documentId}?token=${token}`);

      await new Promise<void>((resolve, reject) => {
        socket.on("open", () => resolve());
        socket.on("error", reject);
      });

      const closeCode = await new Promise<number>((resolve) => {
        socket.on("close", (code) => resolve(code));
      });
      expect(closeCode).toBe(1011);

      // If the earlier failure had escaped as an unhandled rejection, this
      // whole test process would have crashed before reaching this point —
      // reaching a second, independent connection attempt is itself part
      // of the proof that the server (and process) survived.
      const secondDocumentId = `doc-${randomUUID()}`;
      const secondToken = await signCollabToken({ userId: "another-user", documentId: secondDocumentId, role: "OWNER" });
      const secondSocket = new NodeWebSocket(`${brokenBaseUrl}/${secondDocumentId}?token=${secondToken}`);
      await new Promise<void>((resolve, reject) => {
        secondSocket.on("open", () => resolve());
        secondSocket.on("error", reject);
      });
      const secondCloseCode = await new Promise<number>((resolve) => {
        secondSocket.on("close", (code) => resolve(code));
      });
      expect(secondCloseCode).toBe(1011);
    });
  });
});
