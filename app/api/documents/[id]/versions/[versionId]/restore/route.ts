import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { requireMinimumRole } from "@/lib/repositories/documents";
import { restoreVersion, DocumentVersionNotFoundError } from "@/lib/repositories/versions";
import { handleApiError } from "@/lib/http/handleApiError";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  try {
    const userId = await requireUserId();
    const { id, versionId } = await params;
    await requireMinimumRole(userId, id, "EDITOR");

    const version = await restoreVersion(id, versionId, userId);
    return NextResponse.json({ version });
  } catch (error) {
    if (error instanceof DocumentVersionNotFoundError) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    return handleApiError(error);
  }
}
