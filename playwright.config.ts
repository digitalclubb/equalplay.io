import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 390, height: 844 }, // iPhone 14 — mobile-first
    actionTimeout: 5_000,
  },
  projects: [
    {
      name: "Mobile Chrome",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm preview --port 4173",
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
