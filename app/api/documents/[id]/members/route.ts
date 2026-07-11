import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { getDocumentForMember, requireMinimumRole } from "@/lib/repositories/documents";
import { listMembersForDocument, inviteMember } from "@/lib/repositories/members";
import { inviteMemberSchema } from "@/lib/validation/members";
import { readJsonBody, PayloadTooLargeError } from "@/lib/security/readJsonBody";
import { handleApiError } from "@/lib/http/handleApiError";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await getDocumentForMember(userId, id); // any member, including a Viewer, can see who has access
    const members = await listMembersForDocument(id);
    return NextResponse.json({ members });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await requireMinimumRole(userId, id, "OWNER");

    let body: unknown;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return NextResponse.json({ error: "Payload too large" }, { status: 413 });
      }
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = inviteMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    }

    const member = await inviteMember(id, userId, parsed.data.email, parsed.data.role);
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
