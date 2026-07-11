import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { requireMinimumRole } from "@/lib/repositories/documents";
import { updateMemberRole, removeMember } from "@/lib/repositories/members";
import { updateMemberRoleSchema } from "@/lib/validation/members";
import { readJsonBody, PayloadTooLargeError } from "@/lib/security/readJsonBody";
import { handleApiError } from "@/lib/http/handleApiError";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    const userId = await requireUserId();
    const { id, memberId } = await params;
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

    const parsed = updateMemberRoleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    }

    const member = await updateMemberRole(id, userId, memberId, parsed.data.role);
    return NextResponse.json({ member });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  try {
    const userId = await requireUserId();
    const { id, memberId } = await params;
    await requireMinimumRole(userId, id, "OWNER");

    await removeMember(id, userId, memberId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
