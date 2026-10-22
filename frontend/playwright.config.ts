import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  // Each replay test owns a WebGL scene; avoid competing Chrome GPU contexts.
  workers: 1,
  use: { baseURL: 'http://localhost:5173', browserName: 'chromium', channel: 'chrome' },
  webServer: [
    { command: 'uv run --project ../backend --directory ../backend uvicorn main:app --host 127.0.0.1 --port 8000', url: 'http://127.0.0.1:8000/health', reuseExistingServer: !process.env.CI },
    { command: 'pnpm dev --host localhost', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI },
  ],
})
