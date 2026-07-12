import { NextResponse } from "next/server";
import { streamText } from "ai";
import { requireUserId } from "@/lib/auth/session";
import { requireMinimumRole } from "@/lib/repositories/documents";
import { readJsonBody, PayloadTooLargeError } from "@/lib/security/readJsonBody";
import { isRateLimited } from "@/lib/security/rateLimit";
import { rewriteSchema } from "@/lib/validation/ai";
import { aiModel } from "@/lib/ai/client";
import { handleApiError } from "@/lib/http/handleApiError";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await requireMinimumRole(userId, id, "EDITOR"); // a Viewer can't mutate the document via AI any more than by typing

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

    const parsed = rewriteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
    }

    const result = streamText({
      model: aiModel,
      system:
        "You rewrite the given text following the instruction exactly. Reply with only the rewritten text — no preamble, no surrounding quotes, no explanation.",
      prompt: `Instruction: ${parsed.data.instruction}\n\nText:\n${parsed.data.text}`,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    return handleApiError(error);
  }
}
