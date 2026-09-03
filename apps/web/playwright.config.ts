import { defineConfig, devices } from "@playwright/test";

/**
 * Runs against a real, already-running API + Postgres + Redis (see
 * docs/README.md) — this is a genuine end-to-end suite, the same spirit as
 * apps/api's test:e2e, not a mocked-network component test. It starts its
 * own copy of the web app (webServer below) rather than assuming one is
 * already running on :5173.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // tests share the same backend/database — avoid cross-test interference
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
