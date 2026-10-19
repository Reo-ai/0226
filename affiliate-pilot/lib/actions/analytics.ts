"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PLATFORMS, PLATFORM_IDS } from "../constants";
import { csvObjects } from "../csv";
import { prisma } from "../db";
import { parseDateKey } from "../format";
import { optionalInt } from "../metrics";
import { requireProfile } from "../profile";
import { dedupeKey, RECORD_CSV_ALIASES, RECORD_FIELDS } from "../records";
import { type ActionState, firstIssue, formObject, optInt } from "./form";

const recordSchema = z.object({
  recordDate: z.string().transform((v, ctx) => {
    const d = parseDateKey(v);
    if (!d) ctx.addIssue({ code: "custom", message: "日付を正しく入力してください" });
    return d ?? new Date(0);
  }),
  platform: z.enum(PLATFORM_IDS, { error: "媒体を選んでください" }),
  channelAccountId: z.string().optional().transform((v) => v || null),
  affiliateOfferId: z.string().optional().transform((v) => v || null),
  publicationId: z.string().optional().transform((v) => v || null),
  impressions: optInt,
  clicks: optInt,
  conversions: optInt,
  approvedConversions: optInt,
  pendingRevenue: optInt,
  confirmedRevenue: optInt,
  paidRevenue: optInt,
  workMinutes: optInt,
  note: z.string().trim().max(500).default(""),
});

type RecordInput = z.infer<typeof recordSchema>;

function consistency(v: Pick<RecordInput, "impressions" | "clicks" | "conversions">): string | null {
  if (v.clicks !== null && v.impressions !== null && v.clicks > v.impressions) return "クリック数が表示回数より多くなっています";
  if (v.conversions !== null && v.clicks !== null && v.conversions > v.clicks) return "成約数がクリック数より多くなっています（ASPの成果は計測リンク以外から来ることもあるため、その場合はクリックを空欄に）";
  return null;
}

async function upsert(v: RecordInput) {
  const key = dedupeKey(v);
  const existed = await prisma.performanceRecord.findUnique({ where: { dedupeKey: key }, select: { id: true } });
  const data = { ...v, dedupeKey: key };
  await prisma.performanceRecord.upsert({ where: { dedupeKey: key }, create: data, update: data });
  return !!existed;
}

export async function saveRecord(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile();
  const p = recordSchema.safeParse(formObject(fd));
  if (!p.success) return { error: firstIssue(p.error) };
  if (RECORD_FIELDS.every(([k]) => p.data[k] === null)) return { error: "数値を1つ以上入力してください（空欄は「未計測」として扱います）" };
  const bad = consistency(p.data);
  if (bad) return { error: bad };
  const replaced = await upsert(p.data);
  revalidatePath("/analytics");
  return { ok: replaced ? "同じ日・媒体・案件の記録があったため、上書きしました（二重集計を防ぐため）" : "記録しました" };
}

export async function deleteRecord(fd: FormData) {
  await requireProfile();
  await prisma.performanceRecord.delete({ where: { id: String(fd.get("id")) } }).catch(() => null);
  revalidatePath("/analytics");
}

export async function importRecords(_: ActionState, fd: FormData): Promise<ActionState> {
  const profile = await requireProfile();
  const text = String(fd.get("csv") ?? "");
  if (text.length > 2_000_000) return { error: "CSVが大きすぎます（2MBまで）" };
  const { rows, unknownHeaders } = csvObjects(text, RECORD_CSV_ALIASES);
  if (!rows.length) return { error: "取り込める行がありません。1行目に見出し（日付・媒体・表示回数 など）を入れてください" };
  const [accounts, offers, pubs] = await Promise.all([
    prisma.channelAccount.findMany({ where: { profileId: profile.id }, select: { id: true, accountName: true } }),
    prisma.affiliateOffer.findMany({ select: { id: true, name: true } }),
    prisma.publication.findMany({ select: { id: true, publishedUrl: true } }),
  ]);
  const errors: string[] = [];
  let created = 0;
  let replaced = 0;
  for (const [i, r] of rows.entries()) {
    const line = i + 2;
    const date = parseDateKey(r.date ?? "");
    const platform = PLATFORMS.find((p) => p.id === r.platform || p.label === r.platform)?.id;
    if (!date) { errors.push(`${line}行目: 日付が不正`); continue; }
    if (!platform) { errors.push(`${line}行目: 媒体が不明（ブログ/Instagram/X/TikTok/YouTube）`); continue; }
    const nums = Object.fromEntries(RECORD_FIELDS.map(([k]) => [k, optionalInt(r[k])])) as Record<(typeof RECORD_FIELDS)[number][0], number | null>;
    const badNum = RECORD_FIELDS.find(([k]) => r[k]?.trim() && nums[k] === null);
    if (badNum) { errors.push(`${line}行目: ${badNum[1]}が数値ではありません`); continue; }
    const v: RecordInput = {
      recordDate: date,
      platform,
      channelAccountId: accounts.find((a) => a.accountName === r.account)?.id ?? null,
      affiliateOfferId: offers.find((o) => o.name === r.offer)?.id ?? null,
      publicationId: pubs.find((p) => p.publishedUrl === r.url)?.id ?? null,
      ...nums,
      note: (r.note ?? "").slice(0, 500),
    };
    const bad = consistency(v);
    if (bad) { errors.push(`${line}行目: ${bad}`); continue; }
    if (await upsert(v)) replaced++;
    else created++;
  }
  revalidatePath("/analytics");
  const extra = [errors.length ? `取り込めなかった行: ${errors.slice(0, 5).join("、")}${errors.length > 5 ? ` ほか${errors.length - 5}件` : ""}` : "", unknownHeaders.length ? `読み飛ばした列: ${unknownHeaders.join("、")}` : ""].filter(Boolean).join("／");
  return { ok: `新規${created}件・上書き${replaced}件を取り込みました`, error: extra || undefined };
}
