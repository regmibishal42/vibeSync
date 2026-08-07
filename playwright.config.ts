import { defineConfig } from "@playwright/test";
import { config } from "dotenv";

// Same .env.local the app and seed script read, so tests use the real project
// rather than a second source of truth for credentials.
config({ path: ".env.local" });

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  // Tests run against a production build: caching, prerendering and PPR all
  // behave differently under `next dev`, and those are exactly what's under
  // test here.
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
