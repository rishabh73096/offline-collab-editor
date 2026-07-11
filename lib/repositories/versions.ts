import * as Y from "yjs";
import { prisma } from "@/lib/db/prisma";
import { getLiveOrFallbackState, restoreLiveState } from "@/lib/collab/collabServerClient";
import { withDbReadRetry } from "@/lib/db/withRetry";

export class DocumentVersionNotFoundError extends Error {}

export function listVersionsForDocument(documentId: string) {
  return withDbReadRetry(() =>
    prisma.documentVersion.findMany({
      where: { documentId },
      select: {
        id: true,
        label: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  );
}

export async function captureVersion(documentId: string, userId: string, label?: string) {
  const document = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
    select: { state: true },
  });
  const fallback = document.state ? Buffer.from(document.state) : Buffer.from(Y.encodeStateAsUpdate(new Y.Doc()));
  const state = await getLiveOrFallbackState(documentId, fallback);

  return prisma.documentVersion.create({
    data: { documentId, snapshot: new Uint8Array(state), label: label?.trim() || null, createdById: userId },
    select: { id: true, label: true, createdAt: true },
  });
}

/**
 * Restoring is itself logged as a new version (never destructive/in-place),
 * so time-travel stays append-only and auditable: you can always see that a
 * restore happened and what the document looked like right before it.
 */
export async function restoreVersion(documentId: string, versionId: string, userId: string) {
  const version = await prisma.documentVersion.findUnique({
    where: { id: versionId },
    select: { id: true, documentId: true, snapshot: true },
  });
  if (!version || version.documentId !== documentId) {
    throw new DocumentVersionNotFoundError(versionId);
  }

  const resultingState = await restoreLiveState(documentId, Buffer.from(version.snapshot));

  return prisma.documentVersion.create({
    data: {
      documentId,
      snapshot: new Uint8Array(resultingState),
      label: "Restored from an earlier version",
      createdById: userId,
    },
    select: { id: true, label: true, createdAt: true },
  });
}
