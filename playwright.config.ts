import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    channel: process.env.CI ? undefined : "msedge",
  },
  projects: [
    { name: "mobile-390x844", use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
    { name: "ipad-portrait", use: { viewport: { width: 834, height: 1194 }, hasTouch: true } },
    { name: "ipad-landscape", use: { viewport: { width: 1194, height: 834 }, hasTouch: true } },
  ],
  webServer: {
    command: "pnpm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
});
