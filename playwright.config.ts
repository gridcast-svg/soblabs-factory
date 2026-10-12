import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  use: {
    baseURL: "http://127.0.0.1:3000",
    launchOptions: {
      executablePath: process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE"],
      args: ["--no-sandbox"],
    },
    viewport: { width: 1440, height: 1000 },
  },
  workers: 1,
  reporter: "list",
  outputDir: "/tmp/soblabs-playwright-results",
});
