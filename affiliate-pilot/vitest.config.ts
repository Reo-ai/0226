import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    fileParallelism: false,
    // 結合テストは専用の SQLite（prisma/test.db）を使う
    env: { DATABASE_URL: "file:./test.db", OLLAMA_BASE_URL: "http://127.0.0.1:9", ANTHROPIC_API_KEY: "" },
    globalSetup: ["tests/global-setup.ts"],
    testTimeout: 30_000,
  },
});
