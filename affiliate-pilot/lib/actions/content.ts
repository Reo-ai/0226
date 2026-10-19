"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CONTENT_TYPES, PLATFORM_IDS } from "../constants";
import { generateContent, lintContent, platformOf } from "../content";
import { prisma } from "../db";
import { appBaseUrl } from "../env";
import { requireProfile } from "../profile";
import { contentChecksSchema, contentInputsSchema, httpUrl, parseJson } from "../schemas";
import { type ActionState, firstIssue, formObject, optInt } from "./form";

const TYPE_IDS = CONTENT_TYPES.map((c) => c.id) as [string, ...string[]];

const genSchema = z.object({
  contentType: z.enum(TYPE_IDS, { error: "作るものを選んでください" }),
  platform: z.union([z.literal(""), z.enum(PLATFORM_IDS)]).default(""),
  affiliateOfferId: z.string().optional(),
  genre: z.string().trim().max(60).default(""),
  product: z.string().trim().max(120).default(""),
  target: z.string().trim().max(200).default(""),
  keywords: z.string().trim().max(200).default(""),
  appeal: z.string().trim().max(500).default(""),
  tone: z.string().trim().max(60).default(""),
  length: optInt,
  evidence: z.string().trim().max(8000).default(""),
});

export async function generateDraft(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile();
  const p = genSchema.safeParse(formObject(fd));
  if (!p.success) return { error: firstIssue(p.error) };
  const v = p.data;
  const type = v.contentType as (typeof CONTENT_TYPES)[number]["id"];
  const offer = v.affiliateOfferId ? await prisma.affiliateOffer.findUnique({ where: { id: v.affiliateOfferId }, include: { trackingLinks: { take: 1, orderBy: { createdAt: "asc" } } } }) : null;
  const inputs = contentInputsSchema.parse({ ...v, product: v.product || offer?.name || "", genre: v.genre || offer?.category || "" });
  const platform = v.platform || platformOf(type) || "blog";
  const link = offer?.trackingLinks[0];
  const linkUrl = link ? `${await appBaseUrl()}/go/${link.code}?ch=${platform}` : null;

  const r = await generateContent(type, inputs, offer ? { name: offer.name, conversionConditions: offer.conversionConditions, notes: offer.notes } : null, linkUrl);
  const lint = lintContent(`${r.data.title}\n${r.data.body}\n${r.data.cta}`);
  const draft = await prisma.contentDraft.create({
    data: {
      platform,
      contentType: type,
      title: r.data.title,
      body: r.data.body,
      cta: r.data.cta,
      inputs: JSON.stringify(inputs),
      checks: JSON.stringify({ adDisclosure: false, userReviewed: false, facts: [...r.data.factCheckItems, ...lint.issues.map((x) => `注意表現：${x}`)].map((item) => ({ item, checked: false })) }),
      affiliateOfferId: offer?.id ?? null,
      status: "draft",
      generatedBy: r.generatedBy === "fallback" ? "template" : r.generatedBy,
    },
  });
  redirect(`/content?id=${draft.id}${r.warning ? `&warn=${encodeURIComponent(r.warning.slice(0, 300))}` : ""}`);
}

const saveSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1, "タイトルを入力してください").max(120),
  body: z.string().max(30000),
  cta: z.string().max(1000).default(""),
});

export async function saveDraft(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile();
  const p = saveSchema.safeParse(formObject(fd));
  if (!p.success) return { error: firstIssue(p.error) };
  const { id, ...data } = p.data;
  const cur = await prisma.contentDraft.findUnique({ where: { id } });
  if (!cur) return { error: "下書きが見つかりません" };
  const checks = parseJson(contentChecksSchema, cur.checks, { adDisclosure: false, userReviewed: false, facts: [] });
  // 本文を変えたら「確認済み」は取り消す（変更後の内容を見直してもらう）
  const changed = cur.body !== data.body || cur.title !== data.title || cur.cta !== data.cta;
  await prisma.contentDraft.update({
    where: { id },
    data: { ...data, ...(changed ? { checks: JSON.stringify({ ...checks, userReviewed: false }), status: cur.status === "published" ? "published" : "draft" } : {}) },
  });
  revalidatePath("/content");
  return { ok: changed ? "保存しました（内容が変わったので、もう一度確認してください）" : "保存しました" };
}

/** チェック項目の切り替え: name="check" value="ad" | "reviewed" | "fact:<index>" */
export async function toggleCheck(fd: FormData) {
  await requireProfile();
  const id = String(fd.get("id"));
  const key = String(fd.get("check"));
  const cur = await prisma.contentDraft.findUnique({ where: { id } });
  if (!cur) return;
  const c = parseJson(contentChecksSchema, cur.checks, { adDisclosure: false, userReviewed: false, facts: [] });
  if (key === "ad") c.adDisclosure = !c.adDisclosure;
  else if (key === "reviewed") c.userReviewed = !c.userReviewed;
  else if (key.startsWith("fact:")) {
    const i = Number(key.slice(5));
    if (c.facts[i]) c.facts[i].checked = !c.facts[i].checked;
  }
  await prisma.contentDraft.update({ where: { id }, data: { checks: JSON.stringify(c) } });
  revalidatePath("/content");
}

export async function addFactItem(fd: FormData) {
  await requireProfile();
  const id = String(fd.get("id"));
  const item = String(fd.get("item") ?? "").trim().slice(0, 200);
  const cur = await prisma.contentDraft.findUnique({ where: { id } });
  if (!cur || !item) return;
  const c = parseJson(contentChecksSchema, cur.checks, { adDisclosure: false, userReviewed: false, facts: [] });
  c.facts.push({ item, checked: false });
  await prisma.contentDraft.update({ where: { id }, data: { checks: JSON.stringify(c) } });
  revalidatePath("/content");
}

/** 状態の変更。公開OK（approved）は、広告表示・ファクトチェック・本人確認がすべて済んでいる場合のみ */
export async function setDraftStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile();
  const id = String(fd.get("id"));
  const status = String(fd.get("status"));
  if (!["draft", "awaiting_review", "approved"].includes(status)) return { error: "不正な状態です" };
  const cur = await prisma.contentDraft.findUnique({ where: { id } });
  if (!cur) return { error: "下書きが見つかりません" };
  if (status === "approved") {
    const c = parseJson(contentChecksSchema, cur.checks, { adDisclosure: false, userReviewed: false, facts: [] });
    const lint = lintContent(`${cur.title}\n${cur.body}\n${cur.cta}`);
    const missing = [
      !lint.adDisclosure && "本文に「PR」「広告」の表記がありません",
      !c.adDisclosure && "広告表示の確認にチェックが入っていません",
      c.facts.some((f) => !f.checked) && "未確認のファクトチェック項目があります",
      !c.userReviewed && "「内容を自分で確認した」にチェックが入っていません",
    ].filter(Boolean);
    if (missing.length) return { error: `公開OKにできません：${missing.join("／")}` };
  }
  await prisma.contentDraft.update({ where: { id }, data: { status } });
  revalidatePath("/content");
  return { ok: status === "approved" ? "公開OKにしました。投稿したらURLを記録してください" : "状態を変更しました" };
}

const pubSchema = z.object({ id: z.string(), publishedUrl: httpUrl });

export async function recordPublication(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireProfile();
  const p = pubSchema.safeParse(formObject(fd));
  if (!p.success) return { error: firstIssue(p.error) };
  const cur = await prisma.contentDraft.findUnique({ where: { id: p.data.id } });
  if (!cur) return { error: "下書きが見つかりません" };
  if (cur.status !== "approved" && cur.status !== "published") return { error: "公開前のチェックを済ませて「公開OK」にしてから記録してください" };
  await prisma.$transaction([
    prisma.publication.create({ data: { contentDraftId: cur.id, platform: cur.platform, publishedUrl: p.data.publishedUrl, publishedAt: new Date() } }),
    prisma.contentDraft.update({ where: { id: cur.id }, data: { status: "published" } }),
  ]);
  revalidatePath("/content");
  return { ok: "公開URLを記録しました" };
}

export async function deleteDraft(fd: FormData) {
  await requireProfile();
  await prisma.contentDraft.delete({ where: { id: String(fd.get("id")) } }).catch(() => null);
  revalidatePath("/content");
  redirect("/content");
}

/** 動画パイプライン（リポジトリ直下の npm start -- hub-sync）の待ち行列に入れる／取り消す */
export async function queueVideo(fd: FormData) {
  await requireProfile();
  const id = String(fd.get("id"));
  if (fd.get("cancel") === "1") {
    await prisma.contentDraft.updateMany({ where: { id, videoStatus: "queued" }, data: { videoStatus: "", videoUpdatedAt: new Date() } });
  } else {
    const theme = String(fd.get("theme"));
    const service = String(fd.get("service"));
    if (!["fitness", "sleep", "money", "supplements", "skills"].includes(theme) || !["kling", "sora", "both", "none"].includes(service)) return;
    await prisma.contentDraft.update({ where: { id }, data: { videoStatus: "queued", videoTheme: theme, videoService: service, videoResult: "", videoUpdatedAt: new Date() } });
  }
  revalidatePath("/content");
}
