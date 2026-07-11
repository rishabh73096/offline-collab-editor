import { prisma } from "../lib/db/prisma";
import { createPrismaPersistence } from "./persistence";
import { createCollabServer } from "./createCollabServer";

const PORT = Number(process.env.COLLAB_SERVER_PORT ?? 1234);

// Defense in depth on top of the retry/catch handling already in
// roomRegistry.ts and connection.ts: this is a long-running process serving
// every connected document, so one unanticipated rejection (e.g. a database
// connection dropped mid-query, which Neon does when its compute
// auto-suspends) must never be allowed to crash the whole thing and drop
// every other room's live connections along with it.
process.on("unhandledRejection", (reason) => {
  console.error("[collab] unhandled rejection (process kept alive)", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[collab] uncaught exception (process kept alive)", error);
});

const { httpServer } = createCollabServer(createPrismaPersistence(prisma));

httpServer.listen(PORT, () => {
});
