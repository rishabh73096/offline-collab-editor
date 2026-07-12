/**
 * A fixed-window limiter, in-memory per process. Good enough for a single
 * long-running server (or one Vercel instance) but not a substitute for a
 * shared store (Redis, etc.) in a real multi-instance serverless deploy —
 * each cold start / instance gets its own counters. Applied to the AI
 * routes specifically since those are the only ones in this app that cost
 * real money per call, unlike everything else which is just a Postgres
 * query.
 */
const hits = new Map<string, number[]>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);

  if (recent.length >= limit) {
    hits.set(key, recent);
    return true;
  }

  recent.push(now);
  hits.set(key, recent);
  return false;
}
