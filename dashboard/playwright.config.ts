import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3101);

// Build the frontend and serve it from the API server in mock mode, so the
// browser tests never need Zoho credentials.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm start",
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { PORT: String(port), DATA_MODE: "mock" },
  },
});
