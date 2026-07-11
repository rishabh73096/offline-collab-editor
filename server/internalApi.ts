import type { IncomingMessage, ServerResponse } from "node:http";
import * as Y from "yjs";
import { applyTextareaEdit } from "../lib/collab/textSync";
import { readJsonBody, PayloadTooLargeError } from "./readJsonBody";
import type { RoomRegistry } from "./roomRegistry";

const INTERNAL_PATH_PATTERN = /^\/internal\/documents\/([^/]+)\/(state|restore)$/;

function isAuthorized(req: IncomingMessage): boolean {
  const expected = process.env.COLLAB_INTERNAL_SECRET;
  if (!expected) {
    return false;
  }
  return req.headers.authorization === `Bearer ${expected}`;
}

/**
 * Server-to-server API (never exposed to the browser) that lets the Next.js
 * app read the live in-memory document state and apply version restores
 * through the same room the browser clients are connected to — instead of
 * operating on Postgres directly and risking two different truths: what
 * live collaborators see, and what got persisted.
 *
 * A restore is applied as a diff (reusing the exact same minimal-ops
 * text-diffing helper the editor uses for keystrokes) rather than a raw
 * state overwrite, so it propagates to connected clients as a normal,
 * causally-ordered CRDT update instead of destroying their session state.
 *
 * Returns false if the request didn't match an internal route, so the
 * caller can fall through to its regular handler.
 */
export async function tryHandleInternalRequest(
  req: IncomingMessage,
  res: ServerResponse,
  registry: RoomRegistry,
): Promise<boolean> {
  const url = new URL(req.url ?? "", "http://internal");
  const match = INTERNAL_PATH_PATTERN.exec(url.pathname);
  if (!match) {
    return false;
  }

  if (!isAuthorized(req)) {
    res.writeHead(401).end();
    return true;
  }

  const [, documentId, action] = match;

  try {
    if (action === "state" && req.method === "GET") {
      const room = await registry.getOrCreateRoom(documentId);
      const state = Y.encodeStateAsUpdate(room.ydoc);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ state: Buffer.from(state).toString("base64") }));
      return true;
    }

    if (action === "restore" && req.method === "POST") {
      const body = await readJsonBody<{ state?: unknown }>(req);
      if (typeof body.state !== "string" || body.state.length === 0) {
        res.writeHead(400).end();
        return true;
      }

      const targetBytes = Buffer.from(body.state, "base64");
      const scratch = new Y.Doc();
      Y.applyUpdate(scratch, targetBytes, "restore-scratch");
      const targetText = scratch.getText("content").toString();
      scratch.destroy();

      const room = await registry.getOrCreateRoom(documentId);
      const liveText = room.ydoc.getText("content");
      applyTextareaEdit(liveText, liveText.toString(), targetText, "version-restore");

      await registry.persistNow(documentId);

      // The resulting live state is not byte-identical to the version being
      // restored to — it's the diff applied on top of the doc's real CRDT
      // history, not a copy of the old internal structure — so the caller
      // needs this back to log an accurate "what the document became" entry
      // rather than reusing the original snapshot bytes.
      const resultingState = Y.encodeStateAsUpdate(room.ydoc);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, state: Buffer.from(resultingState).toString("base64") }));
      return true;
    }

    res.writeHead(405).end();
    return true;
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      res.writeHead(413).end();
      return true;
    }
    console.error(`[collab] internal API error for doc=${documentId}, action=${action}`, error);
    res.writeHead(500).end();
    return true;
  }
}
