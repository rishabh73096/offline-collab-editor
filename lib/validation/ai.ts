import { z } from "zod";

// A generous cap, not a real document-size limit: this is what gets sent to
// the model per request, so it also bounds token cost per call.
const MAX_AI_TEXT_LENGTH = 20_000;

export const summarizeSchema = z.object({
  text: z.string().trim().min(1, "Nothing to summarize").max(MAX_AI_TEXT_LENGTH),
});
export type SummarizeInput = z.infer<typeof summarizeSchema>;

export const rewriteSchema = z.object({
  text: z.string().trim().min(1, "Select some text first").max(MAX_AI_TEXT_LENGTH),
  instruction: z.string().trim().min(1, "Say how you'd like it rewritten").max(500),
});
export type RewriteInput = z.infer<typeof rewriteSchema>;
