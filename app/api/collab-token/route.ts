import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { getDocumentForMember } from "@/lib/repositories/documents";
import { signCollabToken } from "@/lib/auth/collabToken";
import { handleApiError } from "@/lib/http/handleApiError";

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    const documentId = new URL(request.url).searchParams.get("documentId");
    if (!documentId) {
      return NextResponse.json({ error: "documentId query parameter is required" }, { status: 400 });
    }

    const { role } = await getDocumentForMember(userId, documentId);
    const token = await signCollabToken({ userId, documentId, role });

    return NextResponse.json({ token, expiresInSeconds: 60 });
  } catch (error) {
    return handleApiError(error);
  }
}
