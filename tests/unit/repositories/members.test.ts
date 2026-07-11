import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    documentMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  listMembersForDocument,
  inviteMember,
  updateMemberRole,
  removeMember,
  MemberNotFoundError,
  MemberAlreadyExistsError,
  InviteeNotFoundError,
  CannotModifyOwnMembershipError,
  CannotModifyOwnerError,
} from "@/lib/repositories/members";

const findManyMembers = vi.mocked(prisma.documentMember.findMany);
const findUniqueMember = vi.mocked(prisma.documentMember.findUnique);
const createMember = vi.mocked(prisma.documentMember.create);
const updateMember = vi.mocked(prisma.documentMember.update);
const deleteMember = vi.mocked(prisma.documentMember.delete);
const findUniqueUser = vi.mocked(prisma.user.findUnique);

beforeEach(() => {
  findManyMembers.mockReset();
  findUniqueMember.mockReset();
  createMember.mockReset();
  updateMember.mockReset();
  deleteMember.mockReset();
  findUniqueUser.mockReset();
});

function member(overrides: Partial<{ id: string; role: "OWNER" | "EDITOR" | "VIEWER"; documentId: string; userId: string; createdAt: Date }>) {
  return {
    id: "member-1",
    role: "EDITOR" as const,
    documentId: "doc-1",
    userId: "user-2",
    createdAt: new Date(),
    ...overrides,
  };
}

describe("listMembersForDocument", () => {
  it("sorts Owner first, then Editor, then Viewer", async () => {
    findManyMembers.mockResolvedValue([
      { id: "m-viewer", role: "VIEWER", createdAt: new Date(), user: { id: "u1", name: null, email: "v@x.com" } },
      { id: "m-owner", role: "OWNER", createdAt: new Date(), user: { id: "u2", name: null, email: "o@x.com" } },
      { id: "m-editor", role: "EDITOR", createdAt: new Date(), user: { id: "u3", name: null, email: "e@x.com" } },
    ] as never);

    const result = await listMembersForDocument("doc-1");
    expect(result.map((m) => m.role)).toEqual(["OWNER", "EDITOR", "VIEWER"]);
  });
});

describe("inviteMember", () => {
  it("throws InviteeNotFoundError when no account exists for that email", async () => {
    findUniqueUser.mockResolvedValue(null);
    await expect(inviteMember("doc-1", "owner-1", "nobody@example.com", "EDITOR")).rejects.toBeInstanceOf(
      InviteeNotFoundError,
    );
    expect(createMember).not.toHaveBeenCalled();
  });

  it("throws CannotModifyOwnMembershipError when inviting yourself", async () => {
    findUniqueUser.mockResolvedValue({ id: "owner-1" } as never);
    await expect(inviteMember("doc-1", "owner-1", "me@example.com", "EDITOR")).rejects.toBeInstanceOf(
      CannotModifyOwnMembershipError,
    );
    expect(createMember).not.toHaveBeenCalled();
  });

  it("throws MemberAlreadyExistsError when the invitee already has access", async () => {
    findUniqueUser.mockResolvedValue({ id: "user-2" } as never);
    findUniqueMember.mockResolvedValue(member({}) as never);
    await expect(inviteMember("doc-1", "owner-1", "existing@example.com", "EDITOR")).rejects.toBeInstanceOf(
      MemberAlreadyExistsError,
    );
    expect(createMember).not.toHaveBeenCalled();
  });

  it("creates a new membership at the requested role", async () => {
    findUniqueUser.mockResolvedValue({ id: "user-2" } as never);
    findUniqueMember.mockResolvedValue(null);
    createMember.mockResolvedValue({
      id: "member-1",
      role: "VIEWER",
      createdAt: new Date(),
      user: { id: "user-2", name: "New Person", email: "new@example.com" },
    } as never);

    const result = await inviteMember("doc-1", "owner-1", "new@example.com", "VIEWER");
    expect(result.role).toBe("VIEWER");
    expect(createMember).toHaveBeenCalledWith(
      expect.objectContaining({ data: { documentId: "doc-1", userId: "user-2", role: "VIEWER" } }),
    );
  });
});

describe("updateMemberRole", () => {
  it("throws MemberNotFoundError when the member doesn't belong to this document", async () => {
    findUniqueMember.mockResolvedValue(member({ documentId: "other-doc" }) as never);
    await expect(updateMemberRole("doc-1", "owner-1", "member-1", "VIEWER")).rejects.toBeInstanceOf(
      MemberNotFoundError,
    );
  });

  it("throws CannotModifyOwnMembershipError when changing your own role", async () => {
    findUniqueMember.mockResolvedValue(member({ userId: "owner-1" }) as never);
    await expect(updateMemberRole("doc-1", "owner-1", "member-1", "VIEWER")).rejects.toBeInstanceOf(
      CannotModifyOwnMembershipError,
    );
  });

  it("throws CannotModifyOwnerError when targeting the Owner", async () => {
    findUniqueMember.mockResolvedValue(member({ role: "OWNER", userId: "some-other-owner" }) as never);
    await expect(updateMemberRole("doc-1", "owner-1", "member-1", "VIEWER")).rejects.toBeInstanceOf(
      CannotModifyOwnerError,
    );
  });

  it("updates the role for an ordinary member", async () => {
    findUniqueMember.mockResolvedValue(member({}) as never);
    updateMember.mockResolvedValue({
      id: "member-1",
      role: "VIEWER",
      createdAt: new Date(),
      user: { id: "user-2", name: null, email: "e@x.com" },
    } as never);

    const result = await updateMemberRole("doc-1", "owner-1", "member-1", "VIEWER");
    expect(result.role).toBe("VIEWER");
    expect(updateMember).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "member-1" }, data: { role: "VIEWER" } }),
    );
  });
});

describe("removeMember", () => {
  it("throws CannotModifyOwnMembershipError when removing yourself", async () => {
    findUniqueMember.mockResolvedValue(member({ userId: "owner-1" }) as never);
    await expect(removeMember("doc-1", "owner-1", "member-1")).rejects.toBeInstanceOf(
      CannotModifyOwnMembershipError,
    );
    expect(deleteMember).not.toHaveBeenCalled();
  });

  it("throws CannotModifyOwnerError when removing the Owner", async () => {
    findUniqueMember.mockResolvedValue(member({ role: "OWNER", userId: "some-other-owner" }) as never);
    await expect(removeMember("doc-1", "owner-1", "member-1")).rejects.toBeInstanceOf(CannotModifyOwnerError);
    expect(deleteMember).not.toHaveBeenCalled();
  });

  it("removes an ordinary member", async () => {
    findUniqueMember.mockResolvedValue(member({}) as never);
    deleteMember.mockResolvedValue({} as never);

    await removeMember("doc-1", "owner-1", "member-1");
    expect(deleteMember).toHaveBeenCalledWith({ where: { id: "member-1" } });
  });
});
