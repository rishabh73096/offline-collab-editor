import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { listDocumentsForUser, createDocumentForUser } from "@/lib/repositories/documents";
import { readJsonBody, PayloadTooLargeError } from "@/lib/security/readJsonBody";
import { handleApiError } from "@/lib/http/handleApiError";

const createDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export async function GET() {
  try {
    const userId = await requireUserId();
    const memberships = await listDocumentsForUser(userId);
    const documents = memberships.map((m) => ({ ...m.document, role: m.role }));
    return NextResponse.json({ documents });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();

    let body: unknown;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return NextResponse.json({ error: "Payload too large" }, { status: 413 });
      }
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = createDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    }

    const document = await createDocumentForUser(userId, parsed.data.title);
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
