import { AlertTriangle, Download, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { EmptyState, ErrorNote } from "@/components/ui/states";
import { addFactItem, deleteDraft, generateDraft, queueVideo, recordPublication, saveDraft, setDraftStatus, toggleCheck } from "@/lib/actions/content";
import { CONTENT_TYPES, contentTypeLabel, DRAFT_STATUS, platformLabel, PLATFORMS } from "@/lib/constants";
import { activeProvider } from "@/lib/ai";
import { lintContent } from "@/lib/content";
import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { requireProfile } from "@/lib/profile";
import { contentChecksSchema, parseJson } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { z } from "zod";

export const metadata: Metadata = { title: "AIコンテンツ工房" };
export const maxDuration = 300;

const videoResultSchema = z.object({ title: z.string().optional(), hook: z.string().optional(), imagePath: z.string().optional(), videoPaths: z.array(z.string()).optional(), summaryPath: z.string().optional(), error: z.string().optional() });
const VIDEO_THEMES = [["fitness", "筋トレ・フィットネス"], ["sleep", "睡眠・回復"], ["money", "お金・資産形成"], ["supplements", "サプリ・栄養"], ["skills", "スキル・自己成長"]] as const;
const VIDEO_STATUS: Record<string, string> = { queued: "待機中", running: "生成中", done: "完了", failed: "失敗" };

export default async function ContentPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const profile = await requireProfile();
  const [offers, drafts, current] = await Promise.all([
    prisma.affiliateOffer.findMany({ where: { partnershipStatus: { not: "rejected" } }, orderBy: [{ partnershipStatus: "asc" }, { name: "asc" }], select: { id: true, name: true, category: true } }),
    prisma.contentDraft.findMany({ orderBy: { updatedAt: "desc" }, take: 50, include: { offer: { select: { name: true } }, _count: { select: { publications: true } } } }),
    sp.id ? prisma.contentDraft.findUnique({ where: { id: sp.id }, include: { publications: { orderBy: { publishedAt: "desc" } }, offer: true } }) : null,
  ]);
  const checks = current ? parseJson(contentChecksSchema, current.checks, { adDisclosure: false, userReviewed: false, facts: [] }) : null;
  const lint = current ? lintContent(`${current.title}\n${current.body}\n${current.cta}`) : null;
  const video = current?.videoResult ? parseJson(videoResultSchema, current.videoResult, {}) : null;
  const ai = await activeProvider();
  const defaultType = CONTENT_TYPES.find((c) => c.platform === profile.platforms[0])?.id ?? "blog_outline";

  return (
    <>
      <PageHeader title="AIコンテンツ工房" description="記事構成・投稿文・動画台本を作ります。虚偽の体験談や根拠のない効果表現は作りません。公開前に必ず内容を確認してください。" />

      {current && checks && lint ? (
        <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <CardDescription>{platformLabel(current.platform)}・{contentTypeLabel(current.contentType)}・{current.generatedBy === "template" ? "テンプレート" : current.generatedBy === "manual" ? "手動" : "AI"}で作成</CardDescription>
                <div className="mt-1 flex items-center gap-2"><Badge variant={current.status === "approved" || current.status === "published" ? "success" : "secondary"}>{DRAFT_STATUS[current.status]}</Badge></div>
              </div>
              <div className="flex gap-2">
                <CopyButton text={`${current.title}\n\n${current.body}${current.cta ? `\n\n${current.cta}` : ""}`} label="本文をコピー" size="default" />
                <a href={`/api/content/${current.id}/markdown`} className={buttonVariants({ variant: "outline" })}><Download />Markdown</a>
              </div>
            </CardHeader>
            <CardContent>
              {sp.warn && <ErrorNote className="mb-3" message={sp.warn} />}
              {current.generatedBy === "template" && <p className="mb-3 rounded-lg bg-muted p-3 text-sm">AIに接続していないため、穴埋めテンプレートで作りました。【】の部分を自分の言葉と、確認した事実で埋めてください。</p>}
              <ActionForm action={saveDraft}>
                <input type="hidden" name="id" value={current.id} />
                <Field label="タイトル" htmlFor="d-title"><Input id="d-title" name="title" defaultValue={current.title} required maxLength={120} /></Field>
                <Field label="本文" htmlFor="d-body"><Textarea id="d-body" name="body" defaultValue={current.body} className="min-h-96 font-mono text-[13px] leading-relaxed" /></Field>
                <Field label="CTA（行動を促す一文）" htmlFor="d-cta"><Textarea id="d-cta" name="cta" defaultValue={current.cta} className="min-h-16" /></Field>
                <div className="flex flex-wrap gap-2">
                  <SubmitButton>保存</SubmitButton>
                  <ConfirmDialog trigger={<Button type="button" variant="ghost" className="text-destructive"><Trash2 />削除</Button>} title="この下書きを削除しますか？" description="公開URLの記録も削除されます。" confirmLabel="削除する" formAction={deleteDraft} hidden={{ id: current.id }} />
                </div>
              </ActionForm>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-6">
            <Card className={cn(current.status !== "approved" && current.status !== "published" && "border-primary/50")}>
              <CardHeader><CardTitle>公開前チェック</CardTitle><CardDescription>すべて確認すると「公開OK」にできます。</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                {!lint.adDisclosure && <p className="flex items-start gap-2 text-destructive"><AlertTriangle className="mt-0.5 size-4 shrink-0" />本文に「PR」「広告」の表記が見つかりません。冒頭に入れてください。</p>}
                {lint.issues.length > 0 && (
                  <div className="rounded-lg border border-warning/50 bg-warning/10 p-3">
                    <p className="font-medium">注意が必要な表現</p>
                    <ul className="mt-1 list-disc pl-5">{lint.issues.map((i) => <li key={i}>{i}</li>)}</ul>
                  </div>
                )}
                <ul className="flex flex-col gap-2">
                  <CheckRow id={current.id} check="ad" checked={checks.adDisclosure} label="広告表示（PR・広告）が分かりやすい位置にある" />
                  {checks.facts.map((f, i) => <CheckRow key={i} id={current.id} check={`fact:${i}`} checked={f.checked} label={f.item} />)}
                  <CheckRow id={current.id} check="reviewed" checked={checks.userReviewed} label="内容を自分で読み、事実と違う点・架空の体験談がないことを確認した" />
                </ul>
                <form action={addFactItem} className="flex gap-2">
                  <input type="hidden" name="id" value={current.id} />
                  <Input name="item" aria-label="確認項目を追加" placeholder="確認項目を追加" className="h-8" />
                  <Button size="sm" variant="outline">追加</Button>
                </form>
                <ActionForm action={setDraftStatus} className="flex-row flex-wrap">
                  <input type="hidden" name="id" value={current.id} />
                  <Select name="status" aria-label="状態" defaultValue={current.status === "published" ? "approved" : current.status} className="h-9 w-auto">
                    <option value="draft">下書き</option>
                    <option value="awaiting_review">確認待ち</option>
                    <option value="approved">公開OK</option>
                  </Select>
                  <SubmitButton size="sm">状態を変更</SubmitButton>
                </ActionForm>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>公開URLを記録</CardTitle><CardDescription>SNSへの投稿は手動で行い、投稿後にURLを記録します（自動投稿はしません）。</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <ActionForm action={recordPublication} resetOnSuccess>
                  <input type="hidden" name="id" value={current.id} />
                  <Input name="publishedUrl" type="url" aria-label="公開URL" placeholder="https://" required />
                  <SubmitButton size="sm" variant="outline" className="self-start">記録する</SubmitButton>
                </ActionForm>
                {current.publications.map((p) => (
                  <p key={p.id} className="truncate"><a href={p.publishedUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">{p.publishedUrl}</a><span className="ml-2 text-xs text-muted-foreground">{fmtDateTime(p.publishedAt)}</span></p>
                ))}
              </CardContent>
            </Card>

            {(current.platform === "tiktok" || current.platform === "instagram" || current.platform === "youtube") && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">動画にする{current.videoStatus && <Badge variant={current.videoStatus === "done" ? "success" : current.videoStatus === "failed" ? "destructive" : "secondary"}>{VIDEO_STATUS[current.videoStatus]}</Badge>}</CardTitle>
                  <CardDescription>この台本をもとに、PCの動画パイプライン（リポジトリ直下の <code>npm start -- hub-sync</code>）が画像→動画を生成します。</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                  <form action={queueVideo} className="flex flex-wrap gap-2">
                    <input type="hidden" name="id" value={current.id} />
                    <Select name="theme" aria-label="テーマ" defaultValue={current.videoTheme || "skills"} className="h-9 w-auto">{VIDEO_THEMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
                    <Select name="service" aria-label="動画サービス" defaultValue={current.videoService || "kling"} className="h-9 w-auto">
                      <option value="kling">Kling</option><option value="sora">Sora</option><option value="both">両方</option><option value="none">画像のみ</option>
                    </Select>
                    <SubmitButton size="sm" variant="outline" disabled={current.videoStatus === "queued" || current.videoStatus === "running"}>{current.videoStatus === "done" || current.videoStatus === "failed" ? "作り直す" : "生成待ちに入れる"}</SubmitButton>
                    {current.videoStatus === "queued" && <Button size="sm" variant="ghost" name="cancel" value="1">取り消す</Button>}
                  </form>
                  {video && (video.error || video.videoPaths?.length || video.imagePath) && (
                    <div className="rounded-lg bg-muted p-3 text-xs">
                      {video.error && <p className="text-destructive">エラー：{video.error}</p>}
                      {video.videoPaths?.map((p) => <p key={p}>動画：<code>{p}</code></p>)}
                      {video.imagePath && <p>画像：<code>{video.imagePath}</code></p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card className="self-start">
          <CardHeader><CardTitle>新しく作る</CardTitle><CardDescription>根拠資料（公式サイトの説明・自分のメモ）を貼ると、その範囲で書きます。</CardDescription></CardHeader>
          <CardContent>
            <ActionForm action={generateDraft}>
              <Field label="作るもの" htmlFor="g-type">
                <Select id="g-type" name="contentType" defaultValue={defaultType}>
                  {CONTENT_TYPES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </Select>
              </Field>
              <Field label="媒体（CTA文案のとき）" htmlFor="g-platform">
                <Select id="g-platform" name="platform" defaultValue=""><option value="">種類に合わせる</option>{PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select>
              </Field>
              <Field label="紹介する案件" htmlFor="g-offer">
                <Select id="g-offer" name="affiliateOfferId" defaultValue={sp.offer ?? ""}><option value="">選ばない</option>{offers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="ジャンル" htmlFor="g-genre"><Input id="g-genre" name="genre" defaultValue={profile.niche} /></Field>
                <Field label="商品（案件を選ばないとき）" htmlFor="g-product"><Input id="g-product" name="product" /></Field>
                <Field label="ターゲット" htmlFor="g-target" className="sm:col-span-2"><Input id="g-target" name="target" placeholder="例: 在宅勤務で運動不足の30代" /></Field>
                <Field label="キーワード" htmlFor="g-kw"><Input id="g-kw" name="keywords" placeholder="例: 宅トレ 初心者" /></Field>
                <Field label="文体" htmlFor="g-tone"><Input id="g-tone" name="tone" placeholder="例: やさしい・友だち口調" /></Field>
                <Field label="訴求ポイント" htmlFor="g-appeal" className="sm:col-span-2"><Input id="g-appeal" name="appeal" placeholder="資料で確認できる特徴" /></Field>
                <Field label="文字数の目安" htmlFor="g-len"><Input id="g-len" name="length" inputMode="numeric" placeholder="空欄で種類に合わせる" /></Field>
              </div>
              <Field label="根拠資料" htmlFor="g-ev" hint="ここに書かれていない数字・効果は書きません"><Textarea id="g-ev" name="evidence" className="min-h-24" placeholder="公式サイトの説明、料金、自分の使用メモなど" /></Field>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="background" defaultChecked={ai.provider !== "fallback"} className="mt-0.5 size-4 accent-[var(--primary)]" />
                <span>バックグラウンドで作る<span className="block text-xs text-muted-foreground">AIの応答を待たずに他の画面を使えます。自動化センターで進み具合の確認・キャンセルができます。</span></span>
              </label>
              <SubmitButton pendingLabel="生成中…（ローカルAIは1〜2分かかることがあります）">下書きを作る</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader><CardTitle>下書き一覧</CardTitle></CardHeader>
          <CardContent>
            {drafts.length === 0 ? (
              <EmptyState title="まだ下書きがありません" description="左のフォームから1本目を作りましょう。" />
            ) : (
              <ul className="flex flex-col divide-y">
                {drafts.map((d) => (
                  <li key={d.id}>
                    <Link href={`/content?id=${d.id}`} className={cn("flex flex-col gap-1 py-3 hover:bg-muted/50 rounded-md px-2 -mx-2", d.id === current?.id && "bg-muted")}>
                      <span className="flex flex-wrap items-center gap-2"><strong className="text-sm">{d.title}</strong><Badge variant={d.status === "published" ? "success" : d.status === "approved" ? "default" : "secondary"}>{DRAFT_STATUS[d.status]}</Badge>{d.isDemo && <Badge variant="outline">サンプル</Badge>}</span>
                      <span className="text-xs text-muted-foreground">{platformLabel(d.platform)}・{contentTypeLabel(d.contentType)}{d.offer && `・${d.offer.name}`}・{fmtDateTime(d.updatedAt)}{d._count.publications > 0 && `・公開${d._count.publications}件`}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function CheckRow({ id, check, checked, label }: { id: string; check: string; checked: boolean; label: string }) {
  return (
    <li>
      <form action={toggleCheck} className="flex items-start gap-2">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="check" value={check} />
        <button type="submit" role="checkbox" aria-checked={checked} aria-label={label} className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border cursor-pointer", checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card")}>
          {checked && "✓"}
        </button>
        <span className={cn(checked && "text-muted-foreground")}>{label}</span>
      </form>
    </li>
  );
}
