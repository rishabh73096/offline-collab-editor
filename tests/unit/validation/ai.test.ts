import { describe, it, expect } from "vitest";
import { summarizeSchema, rewriteSchema } from "@/lib/validation/ai";

describe("summarizeSchema", () => {
  it("accepts non-empty text", () => {
    expect(summarizeSchema.safeParse({ text: "Some document content." }).success).toBe(true);
  });

  it("rejects empty text", () => {
    expect(summarizeSchema.safeParse({ text: "   " }).success).toBe(false);
  });

  it("rejects text over the length cap", () => {
    expect(summarizeSchema.safeParse({ text: "a".repeat(20_001) }).success).toBe(false);
  });
});

describe("rewriteSchema", () => {
  it("accepts a valid selection + instruction", () => {
    const result = rewriteSchema.safeParse({ text: "quick brown fox", instruction: "make it formal" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing instruction", () => {
    expect(rewriteSchema.safeParse({ text: "quick brown fox", instruction: "" }).success).toBe(false);
  });

  it("rejects an instruction over the length cap", () => {
    expect(
      rewriteSchema.safeParse({ text: "quick brown fox", instruction: "a".repeat(501) }).success,
    ).toBe(false);
  });
});
