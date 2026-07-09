import type { Role } from "@prisma/client";

const ROLE_RANK: Record<Role, number> = {
  VIEWER: 0,
  EDITOR: 1,
  OWNER: 2,
};

export function roleAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function canEdit(role: Role): boolean {
  return roleAtLeast(role, "EDITOR");
}

export function canManageMembers(role: Role): boolean {
  return roleAtLeast(role, "OWNER");
}
