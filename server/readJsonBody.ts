import type { IncomingMessage } from "node:http";

/**
 * Node http.IncomingMessage counterpart to lib/security/readJsonBody.ts's
 * Fetch Request version — same defense (a hard byte cap enforced while
 * streaming, not just via the spoofable Content-Length header), for the
 * collab server's own internal HTTP endpoints.
 */
export class PayloadTooLargeError extends Error {}

export function readJsonBody<T = unknown>(req: IncomingMessage, maxBytes = 10 * 1024 * 1024): Promise<T> {
  return new Promise((resolve, reject) => {
    const declaredLength = Number(req.headers["content-length"] ?? 0);
    if (declaredLength > maxBytes) {
      req.destroy();
      reject(new PayloadTooLargeError(`Declared body size ${declaredLength} exceeds ${maxBytes} bytes`));
      return;
    }

    const chunks: Buffer[] = [];
    let received = 0;

    req.on("data", (chunk: Buffer) => {
      received += chunk.length;
      if (received > maxBytes) {
        req.destroy();
        reject(new PayloadTooLargeError(`Body exceeded ${maxBytes} bytes`));
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (received === 0) {
        reject(new PayloadTooLargeError("Empty body"));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as T);
      } catch (error) {
        reject(error as Error);
      }
    });

    req.on("error", reject);
  });
}
