import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  webServer: {
    command: "npx vite --port 5173",
    url: "http://localhost:5173/demo/",
    reuseExistingServer: true,
  },
  use: { baseURL: "http://localhost:5173" },
});
