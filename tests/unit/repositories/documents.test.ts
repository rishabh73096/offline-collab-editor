import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    documentMember: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db/prisma";
import {
  getDocumentForMember,
  requireMinimumRole,
  DocumentNotFoundError,
  DocumentForbiddenError,
} from "@/lib/repositories/documents";

const findUnique = vi.mocked(prisma.documentMember.findUnique);

beforeEach(() => {
  findUnique.mockReset();
});

const sampleDocument = { id: "doc1", title: "Doc", createdAt: new Date(), updatedAt: new Date() };

describe("getDocumentForMember", () => {
  it("returns the document and role for an existing member", async () => {
    findUnique.mockResolvedValue({ role: "EDITOR", document: sampleDocument } as never);

    const result = await getDocumentForMember("user1", "doc1");
    expect(result.role).toBe("EDITOR");
    expect(result.document.id).toBe("doc1");
  });

  it("throws DocumentNotFoundError when the user is not a member, instead of leaking existence", async () => {
    findUnique.mockResolvedValue(null);
    await expect(getDocumentForMember("user1", "doc1")).rejects.toBeInstanceOf(DocumentNotFoundError);
  });
});

describe("requireMinimumRole", () => {
  it("succeeds when the member's role meets the minimum", async () => {
    findUnique.mockResolvedValue({ role: "OWNER", document: sampleDocument } as never);
    await expect(requireMinimumRole("user1", "doc1", "EDITOR")).resolves.toMatchObject({ role: "OWNER" });
  });

  it("throws DocumentForbiddenError when a VIEWER attempts an EDITOR-only action", async () => {
    findUnique.mockResolvedValue({ role: "VIEWER", document: sampleDocument } as never);
    await expect(requireMinimumRole("user1", "doc1", "EDITOR")).rejects.toBeInstanceOf(DocumentForbiddenError);
  });

  it("propagates DocumentNotFoundError when there is no membership at all", async () => {
    findUnique.mockResolvedValue(null);
    await expect(requireMinimumRole("user1", "doc1", "VIEWER")).rejects.toBeInstanceOf(DocumentNotFoundError);
  });
});
