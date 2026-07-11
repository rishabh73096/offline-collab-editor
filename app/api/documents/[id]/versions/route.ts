import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { getDocumentForMember, requireMinimumRole } from "@/lib/repositories/documents";
import { listVersionsForDocument, captureVersion } from "@/lib/repositories/versions";
import { readJsonBody, PayloadTooLargeError } from "@/lib/security/readJsonBody";
import { handleApiError } from "@/lib/http/handleApiError";

const captureVersionSchema = z.object({
  label: z.string().trim().max(200).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await getDocumentForMember(userId, id); // any member, including a Viewer, can view history
    const versions = await listVersionsForDocument(id);
    return NextResponse.json({ versions });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await requireMinimumRole(userId, id, "EDITOR");

    let body: unknown;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return NextResponse.json({ error: "Payload too large" }, { status: 413 });
      }
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = captureVersionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    }

    const version = await captureVersion(id, userId, parsed.data.label);
    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
