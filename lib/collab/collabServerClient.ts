function config() {
  const baseUrl = process.env.COLLAB_INTERNAL_URL;
  const secret = process.env.COLLAB_INTERNAL_SECRET;
  if (!baseUrl || !secret) {
    throw new Error("COLLAB_INTERNAL_URL / COLLAB_INTERNAL_SECRET is not configured");
  }
  return { baseUrl, secret };
}

/**
 * Reads the live, in-memory document state from the collab server if a room
 * is currently active for it, so a captured version reflects exactly what
 * connected collaborators see rather than whatever Postgres last persisted
 * (which can lag behind by up to the server's debounce window). Falls back
 * to the caller-supplied last-persisted state if the collab server can't be
 * reached — capturing a version is best-effort by nature, not a
 * correctness-critical write, so degrading gracefully here beats failing
 * the whole request.
 */
export async function getLiveOrFallbackState(documentId: string, fallback: Buffer): Promise<Buffer> {
  try {
    const { baseUrl, secret } = config();
    const response = await fetch(`${baseUrl}/internal/documents/${documentId}/state`, {
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      throw new Error(`collab server responded ${response.status}`);
    }
    const data = (await response.json()) as { state: string };
    return Buffer.from(data.state, "base64");
  } catch (error) {
    console.warn(`[versions] collab server unreachable for doc=${documentId}, using last persisted state`, error);
    return fallback;
  }
}

/**
 * Applies a version's content to the live document as a diff-based CRDT
 * transaction (via the collab server), so any currently connected
 * collaborators see it as a normal real-time edit instead of having their
 * session silently overwritten. Returns the resulting state.
 *
 * Unlike capture, this does not degrade gracefully: if the collab server
 * can't be reached we genuinely don't know whether a room is live, and
 * writing straight to Postgres risks being clobbered the moment that room
 * (or a new connection) reappears and runs its own debounced persist.
 */
export async function restoreLiveState(documentId: string, targetState: Buffer): Promise<Buffer> {
  const { baseUrl, secret } = config();
  const response = await fetch(`${baseUrl}/internal/documents/${documentId}/restore`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ state: targetState.toString("base64") }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to restore document via collab server (${response.status})`);
  }
  const data = (await response.json()) as { state: string };
  return Buffer.from(data.state, "base64");
}
