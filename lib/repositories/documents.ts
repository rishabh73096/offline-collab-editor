import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { roleAtLeast } from "@/lib/authz/roles";

export class DocumentNotFoundError extends Error {}
export class DocumentForbiddenError extends Error {}

/**
 * Every document read/write in the app must go through this file. Centralizing
 * the membership check here means there is exactly one place that can leak a
 * document to a non-member, instead of every route re-implementing the guard.
 */

export function listDocumentsForUser(userId: string) {
  return prisma.documentMember.findMany({
    where: { userId },
    select: {
      role: true,
      document: {
        select: { id: true, title: true, createdAt: true, updatedAt: true },
      },
    },
    orderBy: { document: { updatedAt: "desc" } },
  });
}

export function createDocumentForUser(userId: string, title: string) {
  return prisma.$transaction(async (tx) => {
    const document = await tx.document.create({ data: { title } });
    await tx.documentMember.create({
      data: { documentId: document.id, userId, role: "OWNER" },
    });
    return document;
  });
}

/**
 * Returns the document only if `userId` is a member. A document the user
 * cannot see is treated identically to one that doesn't exist (404, not 403)
 * so membership can't be probed by status code.
 */
export async function getDocumentForMember(userId: string, documentId: string) {
  const membership = await prisma.documentMember.findUnique({
    where: { documentId_userId: { documentId, userId } },
    select: {
      role: true,
      document: {
        select: { id: true, title: true, createdAt: true, updatedAt: true },
      },
    },
  });

  if (!membership) {
    throw new DocumentNotFoundError(documentId);
  }

  return { document: membership.document, role: membership.role };
}

export async function requireMinimumRole(userId: string, documentId: string, minimum: Role) {
  const { document, role } = await getDocumentForMember(userId, documentId);
  if (!roleAtLeast(role, minimum)) {
    throw new DocumentForbiddenError(`Document ${documentId} requires role >= ${minimum}, member has ${role}`);
  }
  return { document, role };
}
