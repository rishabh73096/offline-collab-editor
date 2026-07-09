export class PayloadTooLargeError extends Error {}

const DEFAULT_MAX_BYTES = 100 * 1024;

/**
 * Reads a request body as JSON while enforcing a hard byte cap during the
 * stream read itself (not just via the Content-Length header, which a
 * client can omit or lie about with chunked encoding).
 */
export async function readJsonBody(request: Request, maxBytes = DEFAULT_MAX_BYTES): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new PayloadTooLargeError(`Payload exceeds ${maxBytes} bytes`);
  }

  if (!request.body) {
    throw new PayloadTooLargeError("Empty body");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw new PayloadTooLargeError(`Payload exceeds ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
  }

  const buffer = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  return JSON.parse(buffer.toString("utf-8"));
}
