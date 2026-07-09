import { describe, it, expect } from "vitest";
import { readJsonBody, PayloadTooLargeError } from "@/lib/security/readJsonBody";

describe("readJsonBody", () => {
  it("parses a small valid JSON body", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: JSON.stringify({ hello: "world" }),
    });
    await expect(readJsonBody(request)).resolves.toEqual({ hello: "world" });
  });

  it("rejects a body whose real size exceeds the cap", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: JSON.stringify({ data: "a".repeat(50_000) }),
    });
    await expect(readJsonBody(request, 10 * 1024)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it("rejects a streamed body that exceeds the cap even without a declared Content-Length", async () => {
    const chunk = new TextEncoder().encode("a".repeat(1024));
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < 200; i += 1) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    const request = new Request("http://localhost/test", {
      method: "POST",
      // @ts-expect-error - duplex is required for streaming request bodies but missing from the RequestInit dom lib types
      duplex: "half",
      body: stream,
    });

    await expect(readJsonBody(request, 10 * 1024)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it("throws on malformed JSON instead of crashing the caller", async () => {
    const request = new Request("http://localhost/test", {
      method: "POST",
      body: "{not valid json",
    });
    await expect(readJsonBody(request)).rejects.toBeInstanceOf(SyntaxError);
  });

  it("rejects an empty body", async () => {
    const request = new Request("http://localhost/test", { method: "GET" });
    await expect(readJsonBody(request)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });
});
