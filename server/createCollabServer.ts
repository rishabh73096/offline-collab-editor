import { createServer, type Server } from "node:http";
import { WebSocketServer } from "ws";
import { verifyCollabToken } from "../lib/auth/collabToken";
import { RoomRegistry } from "./roomRegistry";
import { handleConnection } from "./connection";
import { tryHandleInternalRequest } from "./internalApi";
import type { DocumentPersistence } from "./persistence";

// Generous ceiling for a single CRDT update / awareness ping — far below
// anything that could OOM the process, and enforced by `ws` at the frame
// level before a message is ever fully buffered or handed to our code.
const MAX_MESSAGE_BYTES = 256 * 1024;

export interface CollabServerHandle {
  httpServer: Server;
  registry: RoomRegistry;
  close: () => Promise<void>;
}

/**
 * Builds the collab HTTP+WS server without starting it, so it can be
 * pointed at an ephemeral port with an in-memory persistence fake in tests,
 * or at the real port with real Postgres persistence in server/main.ts.
 */
export function createCollabServer(persistence: DocumentPersistence): CollabServerHandle {
  const registry = new RoomRegistry(persistence);

  const httpServer = createServer((req, res) => {
    void (async () => {
      const handled = await tryHandleInternalRequest(req, res, registry);
      if (!handled) {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("offline-collab-editor collab server\n");
      }
    })();
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

  httpServer.on("upgrade", (request, socket, head) => {
    void (async () => {
      try {
        const url = new URL(request.url ?? "", `http://${request.headers.host}`);
        const documentId = url.pathname.replace(/^\//, "");
        const token = url.searchParams.get("token");

        if (!documentId || !token) {
          socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
          socket.destroy();
          return;
        }

        const payload = await verifyCollabToken(token);
        if (payload.documentId !== documentId) {
          socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
          socket.destroy();
          return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
          void handleConnection(ws, payload, registry);
        });
      } catch (error) {
        console.error("[collab] rejected WebSocket upgrade", error);
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
      }
    })();
  });

  return {
    httpServer,
    registry,
    close: () =>
      new Promise<void>((resolve, reject) => {
        wss.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          httpServer.close((closeErr) => (closeErr ? reject(closeErr) : resolve()));
        });
      }),
  };
}
