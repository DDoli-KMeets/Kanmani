import { defineConfig, devices } from "@playwright/test";

/**
 * Runs against a real, already-running API + Postgres + Redis (see
 * docs/README.md) — a genuine end-to-end suite, not a mocked-network
 * component test. Starts its own copy of the staff dashboard (webServer
 * below) rather than assuming one is already running on :5174.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // tests share the same backend/database — avoid cross-test interference
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5174",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5174",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
