import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  // A forgotten test.only would silently skip every other test in CI.
  forbidOnly: !!process.env.CI,
  webServer: {
    command: "npx vite --port 5173",
    url: "http://localhost:5173/demo/",
    reuseExistingServer: true,
  },
  use: {
    baseURL: "http://localhost:5173",
    // Saved to test-results/ only when a test fails; CI uploads it.
    trace: "retain-on-failure",
  },
});
