/**
 * Entry point only: loads env vars before anything else is imported, since
 * lib/db/prisma.ts reads DATABASE_URL at module-load time. A static import
 * of ./main here would be hoisted above this env loading, so the actual
 * bootstrap logic lives in ./main and is imported dynamically instead.
 */
try {
  process.loadEnvFile(".env");
} catch {
  // .env is optional if vars are supplied another way (e.g. the host platform's env)
}
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local is optional (typically only present in local dev)
}

void import("./main");

export {};
