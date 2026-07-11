import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    documentVersion: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/collab/collabServerClient", () => ({
  getLiveOrFallbackState: vi.fn(),
  restoreLiveState: vi.fn(),
}));

import { prisma } from "@/lib/db/prisma";
import { restoreLiveState } from "@/lib/collab/collabServerClient";
import { restoreVersion, DocumentVersionNotFoundError } from "@/lib/repositories/versions";

const findUnique = vi.mocked(prisma.documentVersion.findUnique);
const create = vi.mocked(prisma.documentVersion.create);
const restoreLiveStateMock = vi.mocked(restoreLiveState);

beforeEach(() => {
  findUnique.mockReset();
  create.mockReset();
  restoreLiveStateMock.mockReset();
});

describe("restoreVersion", () => {
  it("throws DocumentVersionNotFoundError when the version does not exist", async () => {
    findUnique.mockResolvedValue(null);
    await expect(restoreVersion("doc-1", "version-1", "user-1")).rejects.toBeInstanceOf(
      DocumentVersionNotFoundError,
    );
    expect(restoreLiveStateMock).not.toHaveBeenCalled();
  });

  it("throws DocumentVersionNotFoundError when the version belongs to a different document (no cross-document restore by guessing an id)", async () => {
    findUnique.mockResolvedValue({
      id: "version-1",
      documentId: "some-other-doc",
      snapshot: new Uint8Array([1, 2, 3]),
    } as never);

    await expect(restoreVersion("doc-1", "version-1", "user-1")).rejects.toBeInstanceOf(
      DocumentVersionNotFoundError,
    );
    expect(restoreLiveStateMock).not.toHaveBeenCalled();
  });

  it("applies the restore via the collab server and logs the resulting state as a new version", async () => {
    findUnique.mockResolvedValue({
      id: "version-1",
      documentId: "doc-1",
      snapshot: new Uint8Array([1, 2, 3]),
    } as never);
    restoreLiveStateMock.mockResolvedValue(Buffer.from([4, 5, 6]));
    create.mockResolvedValue({ id: "version-2", label: "Restored from an earlier version", createdAt: new Date() } as never);

    const result = await restoreVersion("doc-1", "version-1", "user-1");

    expect(restoreLiveStateMock).toHaveBeenCalledWith("doc-1", Buffer.from([1, 2, 3]));
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentId: "doc-1",
          snapshot: new Uint8Array([4, 5, 6]),
          createdById: "user-1",
        }),
      }),
    );
    expect(result.id).toBe("version-2");
  });
});
