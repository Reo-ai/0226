import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const env = { DATABASE_URL: "file:./e2e.db", OLLAMA_BASE_URL: "http://127.0.0.1:9", ANTHROPIC_API_KEY: "", APP_PASSWORD: "", PORT: String(PORT) };

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, locale: "ja-JP", timezoneId: "Asia/Tokyo", trace: "retain-on-failure" },
  projects: [
    { name: "pc", testMatch: /flow\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "smartphone", testMatch: /mobile\.spec\.ts/, dependencies: ["pc"], use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    // テスト用DBを作り直してから起動する
    command: `rm -f prisma/e2e.db prisma/e2e.db-journal && npx prisma migrate deploy && npx tsx prisma/seed.ts && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/onboarding`,
    reuseExistingServer: false,
    timeout: 120_000,
    env,
  },
});
