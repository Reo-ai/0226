// 初期データの投入: npm run db:seed（教材とASP情報。何度実行しても同じ結果になります）
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
