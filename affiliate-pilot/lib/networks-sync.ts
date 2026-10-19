import { NETWORKS } from "./academy/networks";
import { prisma } from "./db";

/** ASP の基本情報（コード内のデータ）を DB に入れる。既存の行は説明だけ更新する */
export async function syncNetworks() {
  if ((await prisma.affiliateNetwork.count()) >= NETWORKS.length) return;
  for (const n of NETWORKS) {
    await prisma.affiliateNetwork.upsert({
      where: { slug: n.slug },
      create: { ...n, lastVerifiedAt: null },
      update: { name: n.name, officialUrl: n.officialUrl, description: n.description, registrationGuide: n.registrationGuide },
    });
  }
}
