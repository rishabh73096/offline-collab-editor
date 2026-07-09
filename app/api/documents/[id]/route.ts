import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { getDocumentForMember } from "@/lib/repositories/documents";
import { handleApiError } from "@/lib/http/handleApiError";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const { document, role } = await getDocumentForMember(userId, id);
    return NextResponse.json({ document: { ...document, role } });
  } catch (error) {
    return handleApiError(error);
  }
}
