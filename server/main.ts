import { prisma } from "../lib/db/prisma";
import { createPrismaPersistence } from "./persistence";
import { createCollabServer } from "./createCollabServer";

const PORT = Number(process.env.COLLAB_SERVER_PORT ?? 1234);

const { httpServer } = createCollabServer(createPrismaPersistence(prisma));

httpServer.listen(PORT, () => {
  console.log(`[collab] listening on :${PORT}`);
});
