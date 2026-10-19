// 初期データの投入: npm run db:seed（教材とASP情報。何度実行しても同じ結果になります）
// tsx は .env を読まないため、DATABASE_URL が未設定なら .env から読み込む（Prisma CLI・Next.js と同じ設定を使う）
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env");
  } catch {
    console.error(".env が見つかりません。.env.example をコピーして .env を作ってください");
    process.exit(1);
  }
}
import { syncLessons } from "../lib/academy";
import { prisma } from "../lib/db";
import { syncNetworks } from "../lib/networks-sync";

async function main() {
  await syncNetworks();
  await syncLessons();
  const [lessons, networks] = await Promise.all([prisma.lesson.count(), prisma.affiliateNetwork.count()]);
  console.log(`教材 ${lessons}レッスン・ASP ${networks}社を登録しました`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
