import { NextResponse } from "next/server";
import { streamText } from "ai";
import { requireUserId } from "@/lib/auth/session";
import { getDocumentForMember } from "@/lib/repositories/documents";
import { readJsonBody, PayloadTooLargeError } from "@/lib/security/readJsonBody";
import { isRateLimited } from "@/lib/security/rateLimit";
import { summarizeSchema } from "@/lib/validation/ai";
import { aiModel } from "@/lib/ai/client";
import { handleApiError } from "@/lib/http/handleApiError";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await getDocumentForMember(userId, id); // any member, including a Viewer, can summarize — it never mutates the document

    if (isRateLimited(`ai:${userId}`, 15, 5 * 60_000)) {
      return NextResponse.json({ error: "Too many AI requests — try again in a few minutes" }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return NextResponse.json({ error: "Payload too large" }, { status: 413 });
      }
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = summarizeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    }

    const result = streamText({
      model: aiModel,
      system:
        "You summarize documents concisely and factually. Reply with the summary only — no preamble, no restating the request, no markdown headers.",
      prompt: `Summarize the following document in 2-4 sentences:\n\n${parsed.data.text}`,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    return handleApiError(error);
  }
}
