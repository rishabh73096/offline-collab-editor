import { PrismaClient, Prisma } from "@prisma/client";

/**
 * Neon (and serverless Postgres generally) can be slow to wake a suspended
 * compute or briefly refuse new connections — surfacing as
 * PrismaClientInitializationError ("Can't reach database server"). That
 * error class specifically means the connection never established, so no
 * query reached the database yet: retrying is unambiguously safe for reads
 * *and* writes alike, unlike a connection dropped mid-query (which the
 * collab server's roomRegistry.ts handles separately, since there the query
 * may have already committed before the connection died).
 *
 * Applied once here via a client extension so every call site — register,
 * login, document/version/member mutations, all of it — gets this without
 * remembering to wrap each one individually.
 */
function withConnectionRetry(client: PrismaClient) {
  return client.$extends({
    query: {
      async $allOperations({ query, args }) {
        try {
          return await query(args);
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientInitializationError)) {
            throw error;
          }
          console.error("[db] connection failed, retrying once", error);
          return query(args);
        }
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof withConnectionRetry> | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  withConnectionRetry(
    new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    }),
  );

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
