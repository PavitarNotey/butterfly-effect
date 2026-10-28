import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  // Each replay test owns a WebGL scene; avoid competing Chrome GPU contexts.
  workers: 1,
  use: {
    baseURL: "http://localhost:5173",
    browserName: "chromium",
    channel: "chrome",
  },
  webServer: [
    {
      command:
        "uv run --directory ../backend python -m uvicorn main:app --host 127.0.0.1 --port 8000",
      url: "http://127.0.0.1:8000/health",
      reuseExistingServer: !process.env.CI,
      env: { AI_PROVIDER: "mock" },
    },
    // AI journeys use this isolated mock-only API even if a live dev API is running.
    {
      command:
        "uv run --directory ../backend python -m uvicorn main:app --host 127.0.0.1 --port 8001",
      url: "http://127.0.0.1:8001/health",
      reuseExistingServer: false,
      env: {
        AI_PROVIDER: "mock",
        AI_REQUESTS_PER_MINUTE: "60",
        AI_CALLS_PER_HOUR: "200",
      },
    },
    {
      command: "pnpm dev --host localhost",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
