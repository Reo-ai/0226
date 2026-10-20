"use server";
import { z } from "zod";
import { dataBlock, runAI } from "@/lib/ai";
import { prisma } from "@/lib/db";
import { detectPlatform, extractFromHtml, extractedFromText, recommend, type Extracted, type Recommendation } from "@/lib/site-analyze";

export type AiRefine = {
  summary: string;
  audience: string;
  genres: { label: string; reason: string }[];
  offerIdeas: { name: string; why: string; action: string }[];
  angles: string[];
};

export type SiteAnalysisState = {
  error?: string;
  result?: Recommendation & { sourceUrl: string; fetched: boolean; fetchNote: string | null; ai: AiRefine | null; generatedBy: string; warning: string | null };
} | null;

const aiSchema = z.object({
  summary: z.string().max(300),
  audience: z.string().max(200),
  genres: z.array(z.object({ label: z.string().max(40), reason: z.string().max(200) })).max(3),
  offerIdeas: z.array(z.object({ name: z.string().max(80), why: z.string().max(200), action: z.string().max(60) })).max(6),
  angles: z.array(z.string().max(200)).max(5),
});

const BLOCKED_HOST = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?|.*\.local$|.*\.internal$)/i;
const isPrivate172 = (h: string) => /^172\.(1[6-9]|2\d|3[01])\./.test(h);

/** URLを取得して本文を抜き出す。SNSで取得できない場合は null を返す（貼り付け入力に委ねる） */
async function fetchPage(url: string): Promise<{ ex: Extracted; note: string | null } | { ex: null; note: string }> {
  let u: URL;
  try { u = new URL(url); } catch { return { ex: null, note: "URLの形式が正しくありません" }; }
  if (!/^https?:$/.test(u.protocol)) return { ex: null, note: "http または https のURLだけ読み込めます" };
  if (BLOCKED_HOST.test(u.hostname) || isPrivate172(u.hostname)) return { ex: null, note: "ローカル・内部ネットワークのURLは読み込めません" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(u, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; AffiliatePilot/1.0; +local)", Accept: "text/html,application/xhtml+xml", "Accept-Language": "ja,en;q=0.8" } });
    if (!res.ok) return { ex: null, note: `取得できませんでした（HTTP ${res.status}）。ログインが必要なページや、外部アクセスを制限しているサービスの可能性があります。` };
    const ct = res.headers.get("content-type") ?? "";
    if (!/html|xml|text/.test(ct)) return { ex: null, note: `HTMLではないコンテンツでした（${ct.split(";")[0]}）` };
    const reader = res.body?.getReader();
    let html = "";
    if (reader) {
      const dec = new TextDecoder();
      while (html.length < 1_500_000) { const { value, done } = await reader.read(); if (done) break; html += dec.decode(value, { stream: true }); }
      reader.cancel().catch(() => {});
    } else html = await res.text();
    const ex = extractFromHtml(html);
    // YouTube: 動画URLなら oEmbed でタイトルとチャンネル名を補う
    if (detectPlatform(url) === "youtube" && /watch\?v=|youtu\.be\//.test(url)) {
      try {
        const o = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, { signal: ctrl.signal });
        if (o.ok) { const j = (await o.json()) as { title?: string; author_name?: string }; ex.title = ex.title || j.title || ""; if (j.author_name) ex.description = `${j.author_name} ${ex.description}`; }
      } catch { /* 補助情報なので無視 */ }
    }
    const textLen = ex.body.length + ex.description.length;
    const note = textLen < 200 ? "ページから読み取れた文章がごく少量でした（JavaScript描画やログイン壁の可能性）。下の欄にプロフィール文や投稿本文を貼り付けると精度が上がります。" : null;
    return { ex, note };
  } catch (e) {
    const msg = e instanceof Error && e.name === "AbortError" ? "取得がタイムアウトしました（12秒）" : `取得に失敗しました：${e instanceof Error ? e.message : String(e)}`;
    return { ex: null, note: msg };
  } finally { clearTimeout(timer); }
}

const inputSchema = z.object({
  url: z.string().trim().max(500).default(""),
  text: z.string().trim().max(50_000).default(""),
  useAi: z.string().optional(),
});

export async function analyzeSite(_: SiteAnalysisState, fd: FormData): Promise<SiteAnalysisState> {
  const parsed = inputSchema.safeParse({ url: fd.get("url"), text: fd.get("text"), useAi: fd.get("useAi") ?? undefined });
  if (!parsed.success) return { error: "入力内容を確認してください" };
  const { url, text, useAi } = parsed.data;
  if (!url && !text) return { error: "URLか、プロフィール文・投稿本文のどちらかを入力してください" };
  const platform = url ? detectPlatform(url) : "unknown";
  if (url && platform === "unknown") return { error: "URLは https:// から入力してください" };

  let ex: Extracted | null = null, fetched = false, fetchNote: string | null = null;
  if (url) {
    const r = await fetchPage(url);
    if (r.ex) { ex = r.ex; fetched = true; fetchNote = r.note; } else fetchNote = r.note;
  }
  if (text) {
    const t = extractedFromText(text, ex?.title);
    ex = ex ? { ...ex, description: `${ex.description} ${t.description}`.trim(), headings: [...ex.headings, ...t.headings], body: `${ex.body}\n${t.body}`, links: [...ex.links, ...t.links] } : t;
  }
  if (!ex) return { error: fetchNote ?? "内容を取得できませんでした。プロフィール文や投稿本文を貼り付けてください。" };

  const offers = await prisma.affiliateOffer.findMany({ select: { id: true, name: true, category: true, targetAudience: true } });
  const rec = recommend(ex, platform, offers);

  let ai: AiRefine | null = null, generatedBy = "rule", warning: string | null = null;
  if (useAi) {
    const material = { platform, title: ex.title, description: ex.description.slice(0, 500), headings: ex.headings.slice(0, 30), body: ex.body.slice(0, 6000), ruleGenres: rec.genres.slice(0, 3).map((g) => g.label) };
    const out = await runAI({
      system: "あなたは日本のアフィリエイト市場に詳しいメディア分析者です。与えられたサイト/SNSの内容から、読者像と、紹介すると成果が出やすいアフィリエイト案件の『種類』を提案します。報酬額・承認率・特定の広告主名の条件は断定しません。薬機法・景品表示法に反する訴求は提案しません。JSONのみで答えます。",
      prompt: `${dataBlock("site", material)}\n次のJSONで答えてください: {"summary": "媒体の内容を1〜2文で", "audience": "主な読者像", "genres": [{"label": "ジャンル", "reason": "根拠"}], "offerIdeas": [{"name": "案件の種類（例: オンライン英会話の無料体験）", "why": "この媒体に合う理由", "action": "成果条件のタイプ（無料登録/購入/来店など）"}], "angles": ["この媒体ならではの訴求の切り口"]}`,
      schema: aiSchema,
      maxTokens: 1200,
      fallback: () => ({ summary: "", audience: "", genres: [], offerIdeas: [], angles: [] }),
    });
    generatedBy = out.generatedBy; warning = out.warning;
    if (out.generatedBy !== "fallback" && (out.data.offerIdeas.length || out.data.summary)) ai = out.data;
  }
  return { result: { ...rec, sourceUrl: url, fetched, fetchNote, ai, generatedBy, warning } };
}
