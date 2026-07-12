import type { prisma as PrismaInstance } from "../lib/db/prisma";

/**
 * Abstracted so the room registry can be unit-tested with an in-memory
 * fake instead of requiring a live Postgres connection.
 */
export interface DocumentPersistence {
  load(documentId: string): Promise<Uint8Array | null>;
  save(documentId: string, state: Uint8Array): Promise<void>;
}

export function createPrismaPersistence(prisma: typeof PrismaInstance): DocumentPersistence {
  return {
    async load(documentId) {
      const record = await prisma.document.findUnique({
        where: { id: documentId },
        select: { state: true },
      });
      if (!record?.state || record.state.length === 0) {
        return null;
      }
      return new Uint8Array(record.state);
    },
    async save(documentId, state) {
      await prisma.document.update({
        where: { id: documentId },
        data: { state: Buffer.from(state) },
      });
    },
  };
}

/**
 * `delayMs` simulates real network/DB latency on `load()`. A delay of 0
 * (the default) resolves fast enough to mask race conditions between room
 * setup and message handling that only show up against a real database —
 * see tests/integration/server/collab.test.ts for the regression test that
 * a nonzero delay here is specifically meant to catch.
 */
export function createInMemoryPersistence(delayMs = 0): DocumentPersistence {
  const store = new Map<string, Uint8Array>();
  return {
    async load(documentId) {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      return store.get(documentId) ?? null;
    },
    async save(documentId, state) {
      store.set(documentId, state);
    },
  };
}
