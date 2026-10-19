"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { csvObjects } from "../csv";
import { prisma } from "../db";
import { parseDateKey } from "../format";
import { evaluateFit } from "../offers";
import { requireProfile } from "../profile";
import { optionalHttpUrl, platformsSchema, parseJson } from "../schemas";
import { type ActionState, firstIssue, formObject, optInt, optPercent } from "./form";

const STATUSES = ["candidate", "applied", "approved", "rejected", "paused"] as const;

const offerSchema = z
  .object({
    id: z.string().optional(),
    affiliateNetworkId: z.string().optional(),
    name: z.string().trim().min(1, "案件名を入力してください").max(120),
    category: z.string().trim().max(60).default(""),
    offerUrl: optionalHttpUrl.default(""),
    commissionType: z.enum(["fixed", "rate"]).default("fixed"),
    commissionAmount: optInt,
    commissionRate: optPercent,
    averageOrderValue: optInt,
    conversionConditions: z.string().trim().max(1000).default(""),
    rejectionConditions: z.string().trim().max(1000).default(""),
    approvalRate: optPercent,
    targetAudience: z.string().trim().max(200).default(""),
    partnershipStatus: z.enum(STATUSES).default("candidate"),
    approvalTiming: z.string().trim().max(200).default(""),
    notes: z.string().trim().max(2000).default(""),
    lastVerifiedAt: z.string().default(""),
  })
  .transform((v) => ({
    ...v,
    // 定率は 平均単価 × 料率 を1件あたりの報酬（円）として保存する
    commissionAmount:
      v.commissionType === "rate"
        ? v.commissionRate !== null && v.averageOrderValue !== null ? Math.round(v.commissionRate * v.averageOrderValue) : null
        : v.commissionAmount,
    lastVerifiedAt: v.lastVerifiedAt ? parseDateKey(v.lastVerifiedAt) : null,
    affiliateNetworkId: v.affiliateNetworkId || null,
  }));

export async function saveOffer(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile();
  const p = offerSchema.safeParse(formObject(fd));
  if (!p.success) return { error: firstIssue(p.error) };
  const { id, ...data } = p.data;
  if (id) await prisma.affiliateOffer.update({ where: { id }, data });
  else await prisma.affiliateOffer.create({ data });
  revalidatePath("/offers");
  if (id) redirect("/offers");
  return { ok: "案件を登録しました" };
}

export async function deleteOffer(fd: FormData) {
  await requireProfile();
  await prisma.affiliateOffer.delete({ where: { id: String(fd.get("id")) } }).catch(() => null);
  revalidatePath("/offers");
  redirect("/offers");
}

export async function setOfferStatus(fd: FormData) {
  await requireProfile();
  const status = String(fd.get("status"));
  if (!(STATUSES as readonly string[]).includes(status)) return;
  await prisma.affiliateOffer.update({ where: { id: String(fd.get("id")) }, data: { partnershipStatus: status } });
  revalidatePath("/offers");
}

/** 「今日確認した」：最終確認日を今日にする */
export async function markVerified(fd: FormData) {
  await requireProfile();
  await prisma.affiliateOffer.update({ where: { id: String(fd.get("id")) }, data: { lastVerifiedAt: new Date() } });
  revalidatePath("/offers");
}

const STATUS_WORDS: [RegExp, (typeof STATUSES)[number]][] = [
  [/提携済|承認|approved/i, "approved"],
  [/申請|審査|applied/i, "applied"],
  [/否認|却下|rejected/i, "rejected"],
  [/停止|終了|paused/i, "paused"],
];

const CSV_ALIASES = {
  asp: ["ASP名", "ASP", "network"],
  name: ["案件名", "プログラム名", "name"],
  category: ["ジャンル", "カテゴリ", "category"],
  offerUrl: ["商品URL", "URL", "広告URL", "url"],
  commission: ["報酬単価", "報酬", "報酬額", "commission"],
  conversionConditions: ["成果条件"],
  rejectionConditions: ["否認条件"],
  approvalRate: ["承認率"],
  partnershipStatus: ["提携状態", "提携ステータス", "status"],
  targetAudience: ["対象ユーザー", "ターゲット"],
  approvalTiming: ["承認時期", "確定時期"],
  lastVerifiedAt: ["最終確認日"],
};

/** 案件のCSVインポート（1行目は見出し）。実在案件の値を推測で埋めないため、空欄は空欄のまま取り込む */
export async function importOffers(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile();
  const text = String(fd.get("csv") ?? "");
  if (text.length > 500_000) return { error: "CSVが大きすぎます（500KBまで）" };
  const { rows, unknownHeaders } = csvObjects(text, CSV_ALIASES);
  if (rows.length === 0) return { error: "取り込める行がありません。1行目に見出し（案件名・ASP名・報酬単価 など）を入れてください" };
  const networks = await prisma.affiliateNetwork.findMany();
  const skipped: string[] = [];
  let created = 0;
  for (const [i, r] of rows.entries()) {
    const line = i + 2;
    if (!r.name) { skipped.push(`${line}行目: 案件名が空です`); continue; }
    const commission = r.commission ? Number(r.commission.replace(/[¥￥,円\s]/g, "")) : null;
    if (commission !== null && (!Number.isFinite(commission) || commission < 0)) { skipped.push(`${line}行目: 報酬単価が数値ではありません`); continue; }
    const rate = r.approvalRate ? Number(r.approvalRate.replace(/[%％\s]/g, "")) : null;
    if (rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)) { skipped.push(`${line}行目: 承認率は0〜100で入力してください`); continue; }
    const url = r.offerUrl && optionalHttpUrl.safeParse(r.offerUrl).success ? r.offerUrl : "";
    if (r.offerUrl && !url) { skipped.push(`${line}行目: URLが不正なため空欄にしました`); }
    const network = r.asp ? networks.find((n) => n.name === r.asp || r.asp.includes(n.name) || n.name.includes(r.asp)) : undefined;
    await prisma.affiliateOffer.create({
      data: {
        name: r.name.slice(0, 120),
        affiliateNetworkId: network?.id ?? null,
        category: (r.category ?? "").slice(0, 60),
        offerUrl: url,
        commissionAmount: commission === null ? null : Math.round(commission),
        conversionConditions: (r.conversionConditions ?? "").slice(0, 1000),
        rejectionConditions: (r.rejectionConditions ?? "").slice(0, 1000),
        approvalRate: rate === null ? null : rate / 100,
        partnershipStatus: STATUS_WORDS.find(([re]) => re.test(r.partnershipStatus ?? ""))?.[1] ?? "candidate",
        targetAudience: (r.targetAudience ?? "").slice(0, 200),
        approvalTiming: (r.approvalTiming ?? "").slice(0, 200),
        lastVerifiedAt: r.lastVerifiedAt ? parseDateKey(r.lastVerifiedAt) : null,
        notes: network || !r.asp ? "" : `ASP: ${r.asp}`,
      },
    });
    created++;
  }
  revalidatePath("/offers");
  const notes = [skipped.length ? `注意: ${skipped.slice(0, 5).join("、")}${skipped.length > 5 ? " ほか" : ""}` : "", unknownHeaders.length ? `読み飛ばした列: ${unknownHeaders.join("、")}` : ""].filter(Boolean).join("／");
  return { ok: `${created}件を取り込みました`, error: notes || undefined };
}

export async function evaluateOfferFit(fd: FormData) {
  const profile = await requireProfile();
  const offer = await prisma.affiliateOffer.findUnique({ where: { id: String(fd.get("id")) } });
  if (!offer) return;
  const accounts = await prisma.channelAccount.findMany({ where: { profileId: profile.id }, select: { targetAudience: true, niche: true } });
  const r = await evaluateFit(offer, {
    niche: profile.niche || accounts.find((a) => a.niche)?.niche || "",
    audiences: accounts.map((a) => a.targetAudience).filter(Boolean),
    platforms: parseJson(platformsSchema, profile.preferredPlatforms, []),
  });
  await prisma.affiliateOffer.update({
    where: { id: offer.id },
    data: { fitScore: r.data.score, fitEvaluation: JSON.stringify({ reasons: r.data.reasons, concerns: r.data.concerns, checkItems: r.data.checkItems }), fitEvaluatedBy: r.generatedBy, fitEvaluatedAt: new Date() },
  });
  revalidatePath("/offers");
  revalidatePath("/offers/compare");
}

// ---- 計測リンク（/go/コード?ch=媒体） ----
export async function createTrackingLink(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile();
  const offerId = String(fd.get("offerId") ?? "");
  const offer = offerId ? await prisma.affiliateOffer.findUnique({ where: { id: offerId } }) : null;
  const url = String(fd.get("url") ?? "").trim() || offer?.offerUrl || "";
  if (!optionalHttpUrl.safeParse(url).success || !url) return { error: "リンク先（ASPの広告リンク）を https:// から入力してください" };
  const requested = String(fd.get("code") ?? "").trim();
  const code = (requested || crypto.randomBytes(4).toString("base64url")).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  if (!code) return { error: "コードは英数字・-・_ で入力してください" };
  if (await prisma.trackingLink.findUnique({ where: { code } })) return { error: `コード「${code}」は使用中です` };
  await prisma.trackingLink.create({
    data: { code, url, name: String(fd.get("name") ?? "").trim().slice(0, 80) || offer?.name || code, affiliateOfferId: offer?.id ?? null, platform: String(fd.get("platform") ?? "").slice(0, 20) },
  });
  revalidatePath("/offers");
  return { ok: `計測リンク /go/${code} を作成しました` };
}

export async function deleteTrackingLink(fd: FormData) {
  await requireProfile();
  await prisma.trackingLink.delete({ where: { id: String(fd.get("id")) } }).catch(() => null);
  revalidatePath("/offers");
}
