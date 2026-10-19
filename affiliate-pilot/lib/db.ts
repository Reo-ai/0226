import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { __prisma?: PrismaClient };

export const prisma = g.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.__prisma = prisma;

// SQLite を WAL モードにする: 裏で自動化ジョブが書き込んでいる間も画面の読み取りが待たされず、
// 「database is locked」も起きにくくなる。失敗しても（Turso 等）動作には影響しない
const g2 = globalThis as unknown as { __walReady?: Promise<void> };
g2.__walReady ??= (async () => {
  try {
    await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL");
    await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000");
    await prisma.$queryRawUnsafe("PRAGMA synchronous = NORMAL");
  } catch {
    /* 対応していない接続先では無視 */
  }
})();
