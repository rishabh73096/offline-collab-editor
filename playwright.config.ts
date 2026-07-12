import { defineConfig, devices } from "@playwright/test";

const APP_PORT = 3100;
const COLLAB_PORT = 3101;
const APP_URL = `http://localhost:${APP_PORT}`;
const COLLAB_URL = `http://localhost:${COLLAB_PORT}`;

/**
 * The e2e suite drives the real app end to end, which means it needs both
 * deployables actually running (see docs/DEPLOYMENT.md for why there are
 * two) — Playwright's webServer option accepts an array specifically for
 * cases like this. Each entry inherits the ambient environment (.env.local
 * locally, workflow `env:` in CI) and only overrides what has to differ for
 * this dedicated port pair, so COLLAB_JWT_SECRET/COLLAB_INTERNAL_SECRET stay
 * identical across both processes without repeating them here.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  // Generous: y-websocket's own staleness watchdog (30s) is what actually
  // detects a simulated-offline connection going quiet — see the offline/
  // reconnect test for why.
  timeout: 90_000,
  use: {
    baseURL: APP_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `npx next dev -p ${APP_PORT}`,
      url: APP_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXTAUTH_URL: APP_URL,
        NEXT_PUBLIC_COLLAB_WS_URL: `ws://localhost:${COLLAB_PORT}`,
        COLLAB_INTERNAL_URL: COLLAB_URL,
      },
    },
    {
      command: "npx tsx server/index.ts",
      url: COLLAB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        PORT: String(COLLAB_PORT),
      },
    },
  ],
});
