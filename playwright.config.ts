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
    // Throwaway Supabase credentials, passed inline. Vite gives environment
    // variables priority over .env files, so a real .env.local is left alone and
    // the hub specs get a build that can never touch a live project.
    command:
      "VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=e2e-anon-key pnpm build && pnpm preview --port 4173",
    port: 4173,
    // Always rebuild. The hub specs depend on the bundle carrying the throwaway
    // credentials above, and reusing a server skips the build that inlines them,
    // which fails the whole hub suite in a way that looks like an app bug.
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
