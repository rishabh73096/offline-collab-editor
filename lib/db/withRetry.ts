/**
 * Neon (and serverless Postgres generally) can suspend its compute on idle
 * and force-close open connections mid-query (SQLSTATE 57P01) — the same
 * failure mode server/roomRegistry.ts already retries around for the
 * long-running collab server. Next.js request handlers are much shorter-
 * lived, but not immune: a request can still land in the middle of exactly
 * that kind of blip, surfacing as a PrismaClientKnownRequestError even
 * though the schema and query are both fine.
 *
 * Only safe for read operations — retrying a mutation risks double-applying
 * it if the first attempt actually committed before the connection dropped.
 */
export async function withDbReadRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error("[db] read failed, retrying once", error);
    return operation();
  }
}
