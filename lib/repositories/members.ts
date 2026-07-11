import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withDbReadRetry } from "@/lib/db/withRetry";

export class MemberNotFoundError extends Error {}
export class MemberAlreadyExistsError extends Error {}
export class InviteeNotFoundError extends Error {}
export class CannotModifyOwnMembershipError extends Error {}
export class CannotModifyOwnerError extends Error {}

const ROLE_ORDER: Record<Role, number> = { OWNER: 0, EDITOR: 1, VIEWER: 2 };

const MEMBER_SELECT = {
  id: true,
  role: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
} as const;

/**
 * Role assignment/management (this file) is deliberately kept separate from
 * document access (lib/repositories/documents.ts). Every mutation here
 * assumes the caller has already verified the acting user is the document's
 * Owner (routes do this via requireMinimumRole, same convention as
 * versions.ts) — this file only owns the membership invariants: no self-
 * demotion/self-removal, and the Owner role can't be reassigned or removed
 * through this surface at all (there is intentionally no ownership-transfer
 * feature yet).
 */

export async function listMembersForDocument(documentId: string) {
  const members = await withDbReadRetry(() =>
    prisma.documentMember.findMany({
      where: { documentId },
      select: MEMBER_SELECT,
    }),
  );
  return members.sort(
    (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

export async function inviteMember(
  documentId: string,
  actingUserId: string,
  email: string,
  role: "EDITOR" | "VIEWER",
) {
  const invitee = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!invitee) {
    throw new InviteeNotFoundError(email);
  }
  if (invitee.id === actingUserId) {
    throw new CannotModifyOwnMembershipError("You already have access to this document.");
  }

  const existing = await prisma.documentMember.findUnique({
    where: { documentId_userId: { documentId, userId: invitee.id } },
  });
  if (existing) {
    throw new MemberAlreadyExistsError(invitee.id);
  }

  return prisma.documentMember.create({
    data: { documentId, userId: invitee.id, role },
    select: MEMBER_SELECT,
  });
}

async function loadOwnedMember(documentId: string, actingUserId: string, memberId: string) {
  const member = await prisma.documentMember.findUnique({ where: { id: memberId } });
  if (!member || member.documentId !== documentId) {
    throw new MemberNotFoundError(memberId);
  }
  if (member.userId === actingUserId) {
    throw new CannotModifyOwnMembershipError("You can't change your own access.");
  }
  if (member.role === "OWNER") {
    throw new CannotModifyOwnerError("The owner's access can't be changed here.");
  }
  return member;
}

export async function updateMemberRole(
  documentId: string,
  actingUserId: string,
  memberId: string,
  role: "EDITOR" | "VIEWER",
) {
  await loadOwnedMember(documentId, actingUserId, memberId);
  return prisma.documentMember.update({
    where: { id: memberId },
    data: { role },
    select: MEMBER_SELECT,
  });
}

export async function removeMember(documentId: string, actingUserId: string, memberId: string) {
  await loadOwnedMember(documentId, actingUserId, memberId);
  await prisma.documentMember.delete({ where: { id: memberId } });
}
