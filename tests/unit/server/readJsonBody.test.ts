import { describe, it, expect } from "vitest";
import { PassThrough } from "node:stream";
import type { IncomingMessage } from "node:http";
import { readJsonBody, PayloadTooLargeError } from "../../../server/readJsonBody";

function makeRequest(body: string, headers: Record<string, string> = {}): IncomingMessage {
  const stream = new PassThrough();
  stream.end(body);
  return Object.assign(stream, { headers }) as unknown as IncomingMessage;
}

describe("server readJsonBody", () => {
  it("parses a small valid JSON body", async () => {
    const req = makeRequest(JSON.stringify({ hello: "world" }));
    await expect(readJsonBody(req)).resolves.toEqual({ hello: "world" });
  });

  it("rejects when Content-Length declares a size over the cap", async () => {
    const req = makeRequest("{}", { "content-length": String(20 * 1024 * 1024) });
    await expect(readJsonBody(req, 10 * 1024 * 1024)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it("rejects a body that streams past the cap even without a declared Content-Length", async () => {
    const req = makeRequest("a".repeat(2000));
    await expect(readJsonBody(req, 1000)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it("rejects an empty body", async () => {
    const req = makeRequest("");
    await expect(readJsonBody(req)).rejects.toBeInstanceOf(PayloadTooLargeError);
  });

  it("rejects malformed JSON instead of crashing the caller", async () => {
    const req = makeRequest("{not valid json");
    await expect(readJsonBody(req)).rejects.toBeInstanceOf(SyntaxError);
  });
});
