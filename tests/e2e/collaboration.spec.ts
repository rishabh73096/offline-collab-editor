import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * The scripted proof of the assignment's hardest requirement: two
 * collaborators, one of whom goes offline mid-edit, converge on the same
 * document with neither person's words lost — no merge conflicts, no manual
 * resolution. Along the way this also exercises registration, local-first
 * document creation, the invite/role-management flow, and the sync-status
 * indicator, so a single run is a reasonably complete smoke test of the
 * whole app, not just the CRDT merge.
 */

const prisma = new PrismaClient();
const stamp = Date.now();
const ownerEmail = `e2e-owner-${stamp}@example.com`;
const guestEmail = `e2e-guest-${stamp}@example.com`;
const password = "password1234";

async function registerAndLogin(context: BrowserContext, name: string, email: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto("/register");
  await page.fill('input[name="name"]', name);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/documents", { timeout: 15_000 });
  return page;
}

test.afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: [ownerEmail, guestEmail] } } });
  const userIds = users.map((u) => u.id);
  await prisma.documentMember.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.document.deleteMany({ where: { members: { none: {} } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

test("two collaborators converge after one edits offline and reconnects", async ({ browser }) => {
  const ownerContext = await browser.newContext();
  const guestContext = await browser.newContext();

  const ownerPage = await registerAndLogin(ownerContext, "E2E Owner", ownerEmail);
  await registerAndLogin(guestContext, "E2E Guest", guestEmail);

  await test.step("owner creates a document (local-first: no wait on a spinner)", async () => {
    await ownerPage.fill("#title", "E2E Collab Doc");
    await ownerPage.click('button:has-text("New document")');
    await ownerPage.waitForSelector('a:has-text("E2E Collab Doc")', { timeout: 10_000 });
  });

  await ownerPage.click('a:has-text("E2E Collab Doc")');
  await ownerPage.waitForURL(/\/documents\/[^/]+$/, { timeout: 15_000 });
  const docId = ownerPage.url().split("/documents/")[1];

  await test.step("owner invites the guest as an Editor", async () => {
    await ownerPage.goto(`/documents/${docId}/share`);
    await ownerPage.fill("#invite-email", guestEmail);
    await ownerPage.click('button:has-text("Invite")');
    await ownerPage.waitForSelector(`text=${guestEmail}`, { timeout: 10_000 });
  });

  await ownerPage.goto(`/documents/${docId}`);
  const guestPage = await guestContext.newPage();
  await guestPage.goto(`/documents/${docId}`);

  const ownerEditor = ownerPage.getByLabel("Document content");
  const guestEditor = guestPage.getByLabel("Document content");

  const ownerSyncStatus = ownerPage.getByRole("status").filter({ hasText: /^(Synced|Offline|Connecting|Syncing|Sync error)$/ });
  const guestSyncStatus = guestPage.getByRole("status").filter({ hasText: /^(Synced|Offline|Connecting|Syncing|Sync error)$/ });

  await expect(ownerSyncStatus).toHaveText("Synced", { timeout: 20_000 });
  await expect(guestSyncStatus).toHaveText("Synced", { timeout: 20_000 });

  await test.step("live sync: owner's edit reaches the guest", async () => {
    await ownerEditor.fill("Line from the owner.");
    await expect(guestEditor).toHaveValue("Line from the owner.", { timeout: 10_000 });
  });

  await test.step("guest goes offline and keeps editing", async () => {
    await guestContext.setOffline(true);
    await expect(guestSyncStatus).toHaveText("Offline", { timeout: 10_000 });
    await guestEditor.fill("Line from the owner.\nLine from the guest, written while offline.");
  });

  await test.step("owner edits concurrently while the guest is disconnected", async () => {
    await ownerEditor.fill("Line from the owner.\nA second owner line, added while the guest was offline.");
  });

  await test.step("guest reconnects and both sides converge without losing either edit", async () => {
    await guestContext.setOffline(false);

    // Chromium's CDP offline emulation blackholes traffic on the existing
    // WebSocket rather than closing it immediately, so the client doesn't
    // necessarily get a close/error event the instant connectivity returns.
    // y-websocket's WebsocketProvider has its own 30s staleness watchdog
    // (messageReconnectTimeout) that force-reconnects once it's gone that
    // long without hearing from the server — that's the actual detection
    // path here, not an immediate socket error, hence the generous timeout.
    await expect(guestSyncStatus).toHaveText("Synced", { timeout: 45_000 });

    await expect(async () => {
      const ownerText = await ownerEditor.inputValue();
      const guestText = await guestEditor.inputValue();
      expect(ownerText).toBe(guestText);
      expect(ownerText).toContain("guest, written while offline");
      expect(ownerText).toContain("second owner line");
    }).toPass({ timeout: 15_000 });
  });
});
