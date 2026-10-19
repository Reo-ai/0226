"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { requireProfile } from "../profile";

/** 公式サイトで内容を確認した日を記録する（確認していない情報は「未確認」のまま） */
export async function markNetworkVerified(fd: FormData) {
  await requireProfile();
  const slug = String(fd.get("slug"));
  const undo = fd.get("undo") === "1";
  await prisma.affiliateNetwork.update({ where: { slug }, data: { lastVerifiedAt: undo ? null : new Date() } });
  revalidatePath("/offers/asp");
  revalidatePath(`/offers/asp/${slug}`);
}
