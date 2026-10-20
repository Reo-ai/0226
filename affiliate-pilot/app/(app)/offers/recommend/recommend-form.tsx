"use client";
import { useActionState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { ErrorNote, Notice } from "@/components/ui/states";
import { analyzeSite, type SiteAnalysisState } from "@/lib/actions/site";
import { PLATFORM_LABEL } from "@/lib/site-analyze";

const CONF = { high: ["高", "bg-success/15 text-success"], medium: ["中", "bg-warning/15 text-warning"], low: ["低", "bg-muted text-muted-foreground"] } as const;

export function RecommendForm({ aiAvailable }: { aiAvailable: boolean }) {
  const [state, action, pending] = useActionState<SiteAnalysisState, FormData>(analyzeSite, null);
  const r = state?.result;
  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-3" aria-busy={pending}>
        <Card>
          <CardHeader><CardTitle>媒体のURLを入れる</CardTitle><CardDescription>ブログ・Webサイト・YouTube・Instagram・X・TikTok・note のURL。SNSは取得できる情報が少ないので、下にプロフィール文や投稿も貼ると精度が上がります。</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Field label="URL" htmlFor="site-url"><Input id="site-url" name="url" type="url" placeholder="https://example.com/ または https://www.instagram.com/あなたのID/" /></Field>
            <Field label="プロフィール文・投稿本文・記事のテキスト（任意。SNSは推奨）" htmlFor="site-text" hint="最近の投稿のキャプションを3〜5件、記事の冒頭などを貼り付け"><Textarea id="site-text" name="text" className="min-h-28" placeholder="例: 30代会社員。未経験からWebデザインを学習中。毎日の学習記録と、使ってよかった教材を発信しています…" /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="useAi" value="1" defaultChecked={aiAvailable} disabled={!aiAvailable} className="size-4" />AIでさらに詳しく分析する{!aiAvailable && <span className="text-xs text-muted-foreground">（AI未接続：ルール判定のみ）</span>}</label>
            <ErrorNote message={state?.error} />
            <SubmitButton pendingLabel="分析中…" className="self-start"><Sparkles />おすすめ案件を提案する</SubmitButton>
          </CardContent>
        </Card>
      </form>

      {r && (
        <div className="fade-in flex flex-col gap-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{r.title || r.sourceUrl || "貼り付けたテキスト"}</CardTitle>
                <Badge variant="outline">{PLATFORM_LABEL[r.platform]}</Badge>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONF[r.confidence][1]}`}>判定の確からしさ：{CONF[r.confidence][0]}</span>
                <Badge variant="outline">{r.ai ? "AI＋ルール" : "ルール判定"}</Badge>
              </div>
              <CardDescription>{r.fetched ? "URLの内容を読み取りました。" : "URLの内容は取得せず、貼り付けたテキストから判定しました。"}{r.fetchNote && ` ${r.fetchNote}`}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {r.notes.map((n) => <Notice key={n} message={n} />)}
              {r.warning && <Notice message={r.warning} />}
              {r.ai && <div className="rounded-lg bg-accent/60 p-3 text-sm"><p><strong>媒体の要約：</strong>{r.ai.summary}</p><p className="mt-1"><strong>主な読者：</strong>{r.ai.audience}</p></div>}
              <div>
                <p className="mb-1 text-sm font-medium">ジャンル判定</p>
                <ul className="flex flex-col gap-1">
                  {r.genres.map((g) => (
                    <li key={g.id} className="flex items-center gap-2 text-sm"><span className="w-36 shrink-0 truncate">{g.label}</span><span className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><i className="block h-full bg-primary" style={{ width: `${Math.round(g.share * 100)}%` }} /></span><span className="tabular w-10 text-right text-xs text-muted-foreground">{Math.round(g.share * 100)}%</span><span className="hidden text-xs text-muted-foreground sm:inline">根拠語：{g.hits.slice(0, 4).join("・")}</span></li>
                  ))}
                  {!r.genres.length && <li className="text-sm text-muted-foreground">判定できませんでした</li>}
                </ul>
                {r.ai?.genres.length ? <p className="mt-2 text-xs text-muted-foreground">AIの見立て：{r.ai.genres.map((g) => `${g.label}（${g.reason}）`).join(" / ")}</p> : null}
              </div>
              {r.existingAsps.length > 0 && <p className="text-sm">すでに使っているASPのリンクを検出：<strong>{r.existingAsps.join("、")}</strong></p>}
            </CardContent>
          </Card>

          {r.ai?.offerIdeas.length ? (
            <Card className="border-primary/40">
              <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" />AIのおすすめ案件（種類）</CardTitle><CardDescription>この媒体の内容に合わせた提案です。具体的な広告主・報酬・条件はASPで検索して確認してください。</CardDescription></CardHeader>
              <CardContent>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {r.ai.offerIdeas.map((o) => <li key={o.name} className="rounded-lg border p-3 text-sm"><strong>{o.name}</strong><span className="ml-2 text-xs text-muted-foreground">{o.action}</span><p className="mt-1 text-muted-foreground">{o.why}</p></li>)}
                </ul>
                {r.ai.angles.length > 0 && <ul className="mt-3 list-disc pl-5 text-sm">{r.ai.angles.map((a) => <li key={a}>{a}</li>)}</ul>}
              </CardContent>
            </Card>
          ) : null}

          {r.picks.map((p, i) => (
            <Card key={p.genre}>
              <CardHeader><CardTitle>{i + 1}. {p.label} に合う案件</CardTitle><CardDescription>探す場所：{p.asps.join("・")}（ASP内で「{p.label.split("・")[0]}」などで検索）</CardDescription></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-sm font-medium">案件の種類と成果条件のタイプ</p>
                  <ul className="flex flex-col gap-1 text-sm">{p.offerTypes.map((o) => <li key={o.name} className="rounded-md border px-3 py-2"><strong>{o.name}</strong><span className="ml-2 text-xs text-muted-foreground">{o.action}</span></li>)}</ul>
                </div>
                <div>
                  <p className="mb-1 text-sm font-medium">訴求の切り口</p>
                  <ul className="list-disc pl-5 text-sm">{p.angles.map((a) => <li key={a}>{a}</li>)}</ul>
                  {p.cautions.length > 0 && <div className="mt-2 rounded-md border-l-2 border-warning bg-muted/50 px-3 py-2 text-xs">{p.cautions.map((c) => <p key={c}>⚠ {c}</p>)}</div>}
                </div>
              </CardContent>
            </Card>
          ))}

          {r.matchedOffers.length > 0 && (
            <Card>
              <CardHeader><CardTitle>登録済みの案件で合うもの</CardTitle></CardHeader>
              <CardContent><ul className="flex flex-wrap gap-2">{r.matchedOffers.map((o) => <li key={o.id}><Link href={`/offers?edit=${o.id}`} className="rounded-full border px-3 py-1 text-sm hover:border-primary">{o.name}<span className="ml-1 text-xs text-muted-foreground">{o.genre}</span></Link></li>)}</ul></CardContent>
            </Card>
          )}
          <p className="text-xs text-muted-foreground">報酬額・承認率・成果条件はここでは表示しません。ASPの案件ページで確認した値を「案件」に登録すると、比較や収益シミュレーションに使えます。<Link href="/offers" className="ml-1 text-primary underline">案件を登録する</Link></p>
        </div>
      )}
    </div>
  );
}
