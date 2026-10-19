import { Download, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { ConnectionTest } from "@/components/connection-test";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { aiConfig, CLAUDE_MODELS, OLLAMA_MODELS } from "@/lib/ai";
import { clearDemoAction, loadDemoAction, restoreBackup, saveAiConfig, saveSchedule, setUiMode } from "@/lib/actions/settings";
import { EXPERIENCE_LEVELS, platformLabel } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { fmtDate, minutesLabel, yen } from "@/lib/format";
import { activeGoal, requireProfile } from "@/lib/profile";
import { DEFAULT_SCHEDULE, describeNext, lastRunsSchema, scheduleSchema } from "@/lib/scheduler";
import { getUiMode } from "@/lib/ui-mode";
import { getSetting } from "@/lib/settings";

export const metadata: Metadata = { title: "設定" };

export default async function SettingsPage() {
  const profile = await requireProfile();
  const [cfg, goal, demoCount, schedule, lastRuns] = await Promise.all([
    aiConfig(), activeGoal(profile.id), prisma.performanceRecord.count({ where: { isDemo: true } }),
    getSetting("schedule", scheduleSchema, DEFAULT_SCHEDULE), getSetting("schedule_last", lastRunsSchema, {}),
  ]);
  const next = describeNext(schedule, new Date(), lastRuns);
  const mode = await getUiMode();
  const hasClaudeKey = !!process.env.ANTHROPIC_API_KEY;
  return (
    <>
      <PageHeader title="設定" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="ai" className="lg:col-span-2">
          <CardHeader>
            <CardTitle>AIの接続</CardTitle>
            <CardDescription>無料で使えるローカルAI（Ollama）を優先します。AIが使えないときも、ルールとテンプレートで主な機能は動きます。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <ActionForm action={saveAiConfig}>
              <Field label="使うAI" htmlFor="ai-mode">
                <Select id="ai-mode" name="mode" defaultValue={cfg.mode}>
                  <option value="auto">自動（ローカルAI → Claude → AIなし）</option>
                  <option value="ollama">ローカルAI（Ollama）のみ</option>
                  <option value="claude">Claude のみ（有料・APIキーが必要）</option>
                  <option value="off">AIを使わない（ルール・テンプレートのみ）</option>
                </Select>
              </Field>
              <Field label="Ollama の接続先" htmlFor="ai-url" hint="このPC（http://127.0.0.1:11434）か、同じLAN内のPCのみ指定できます">
                <Input id="ai-url" name="ollamaBaseUrl" defaultValue={cfg.ollamaBaseUrl} />
              </Field>
              <Field label="Ollama のモデル" htmlFor="ai-model" hint="一覧にないモデルも名前を入力すれば使えます">
                <Input id="ai-model" name="ollamaModel" defaultValue={cfg.ollamaModel} list="ollama-models" />
                <datalist id="ollama-models">{OLLAMA_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</datalist>
              </Field>
              <Field label="Claude のモデル" htmlFor="ai-claude" hint={hasClaudeKey ? "APIキー設定済み" : ".env に ANTHROPIC_API_KEY を設定すると使えます（従量課金）"}>
                <Select id="ai-claude" name="claudeModel" defaultValue={cfg.claudeModel}>{CLAUDE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</Select>
              </Field>
              <Field label="応答を待つ時間（秒）" htmlFor="ai-timeout" hint="PCの性能が低い場合は長めに"><Input id="ai-timeout" name="timeoutSec" inputMode="numeric" defaultValue={cfg.timeoutSec} /></Field>
              <SubmitButton className="self-start">保存</SubmitButton>
            </ActionForm>
            <div className="flex flex-col gap-4">
              <ConnectionTest />
              <div className="rounded-lg border p-4 text-sm">
                <h3 className="font-bold">ローカルAIの準備（無料）</h3>
                <ol className="mt-2 list-decimal pl-5">
                  <li><a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer" className="text-primary underline">ollama.com</a> から Ollama をインストール</li>
                  <li>ターミナルで <code className="rounded bg-muted px-1">ollama pull {cfg.ollamaModel}</code> を実行（数GBのダウンロード）</li>
                  <li>Ollama を起動した状態で「接続テスト」を押す</li>
                </ol>
                <h4 className="mt-3 font-bold">PCの目安</h4>
                <ul className="mt-1 flex flex-col gap-1">{OLLAMA_MODELS.map((m) => <li key={m.id}><code className="rounded bg-muted px-1">{m.id}</code>：{m.requirement}</li>)}</ul>
                <p className="mt-2 text-xs text-muted-foreground">目安を下回るPCでは応答が遅くなるか、生成に失敗します。その場合は軽いモデルにするか「AIを使わない」を選んでください。</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card id="display" className="lg:col-span-2">
          <CardHeader><CardTitle>表示モード</CardTitle><CardDescription>初心者は「かんたん表示」がおすすめです。メニューが5つになり、入力欄も必要なものだけになります。全機能はいつでも「すべてのメニュー」から使えます。</CardDescription></CardHeader>
          <CardContent>
            <form action={setUiMode} className="flex flex-wrap gap-3">
              {(["simple", "full"] as const).map((m) => (
                <button key={m} name="mode" value={m} className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors hover:border-primary cursor-pointer ${mode === m ? "border-primary bg-accent" : ""}`} aria-pressed={mode === m}>
                  <strong>{m === "simple" ? "かんたん表示" : "くわしい表示"}</strong>
                  <span className="block text-xs text-muted-foreground">{m === "simple" ? "メニュー5つ・今日の1歩が中心・入力は最小限" : "全メニュー・指標の詳細・すべての入力欄"}</span>
                </button>
              ))}
            </form>
          </CardContent>
        </Card>

        <Card id="schedule">
          <CardHeader><CardTitle>定期実行</CardTitle><CardDescription>アプリを起動している間、決まった時刻に自動で実行します。PCを閉じていた日は、次に起動したときに1回だけ実行します。</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <ActionForm action={saveSchedule}>
              <label className="flex items-center gap-2 font-medium"><input type="checkbox" name="enabled" defaultChecked={schedule.enabled} className="size-4 accent-[var(--primary)]" />定期実行を使う</label>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2"><input type="checkbox" name="dailyTasks" defaultChecked={schedule.dailyTasks} className="size-4 accent-[var(--primary)]" />毎日、今日のタスクを作る</label>
                <Input type="time" name="dailyTime" aria-label="毎日の実行時刻" defaultValue={schedule.dailyTime} className="h-9 w-28" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2"><input type="checkbox" name="weeklyReport" defaultChecked={schedule.weeklyReport} className="size-4 accent-[var(--primary)]" />週次レポート</label>
                <label className="flex items-center gap-2"><input type="checkbox" name="improvement" defaultChecked={schedule.improvement} className="size-4 accent-[var(--primary)]" />改善案</label>
                <Select name="weeklyDay" aria-label="毎週の実行曜日" defaultValue={String(schedule.weeklyDay)} className="h-9 w-24">
                  {"日月火水木金土".split("").map((d, i) => <option key={d} value={i}>{d}曜</option>)}
                </Select>
                <Input type="time" name="weeklyTime" aria-label="毎週の実行時刻" defaultValue={schedule.weeklyTime} className="h-9 w-28" />
              </div>
              <SubmitButton size="sm" className="self-start">保存</SubmitButton>
            </ActionForm>
            {next.length > 0 && (
              <ul className="text-muted-foreground">{next.map((n) => <li key={n.label}>{n.label}：{n.when}</li>)}</ul>
            )}
            <p className="text-xs text-muted-foreground">週次レポートと改善案は「確認待ち」で自動化センターに届きます。承認するまで提案には反映されません。</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>目標と条件</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <dl className="grid grid-cols-2 gap-2">
              <dt className="text-muted-foreground">経験</dt><dd>{EXPERIENCE_LEVELS.find((e) => e.id === profile.experienceLevel)?.label}</dd>
              <dt className="text-muted-foreground">目標月収</dt><dd>{yen(goal?.targetMonthlyRevenue ?? null)}</dd>
              <dt className="text-muted-foreground">期限</dt><dd>{fmtDate(goal?.targetDate)}{goal?.challengeMode && "（チャレンジ）"}</dd>
              <dt className="text-muted-foreground">1日の作業時間</dt><dd>{minutesLabel(profile.dailyWorkMinutes)}</dd>
              <dt className="text-muted-foreground">月額予算</dt><dd>{yen(profile.monthlyBudget)}</dd>
              <dt className="text-muted-foreground">媒体</dt><dd>{profile.platforms.map(platformLabel).join("・")}</dd>
              <dt className="text-muted-foreground">ジャンル</dt><dd>{profile.niche || "未設定"}</dd>
            </dl>
            <Link href="/onboarding" className={buttonVariants({ variant: "outline", size: "sm" }) + " self-start"}>目標と条件を設定し直す</Link>
            <p className="text-xs text-muted-foreground">設定し直すと新しいロードマップが作られます。これまでの記録は残ります。</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>バックアップと復元</CardTitle><CardDescription>データはこのPCの SQLite ファイル（prisma/dev.db）に保存されています。</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <a href="/api/backup" className={buttonVariants({ variant: "outline" }) + " self-start"}><Download />バックアップをダウンロード</a>
            <ActionForm action={restoreBackup} className="rounded-lg border p-3">
              <Field label="バックアップから復元" htmlFor="bk-file"><Input id="bk-file" name="file" type="file" accept="application/json,.json" required className="h-auto py-1.5" /></Field>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" value="yes" className="mt-0.5 size-4 accent-[var(--destructive)]" />現在のデータをすべて削除して、バックアップの内容に置き換える</label>
              <SubmitButton variant="destructive" size="sm" className="self-start" pendingLabel="復元中…">復元する</SubmitButton>
            </ActionForm>
          </CardContent>
        </Card>

        <Card id="sample">
          <CardHeader><CardTitle>サンプルデータ</CardTitle><CardDescription>画面の動きを試すための架空のデータです。実際の記録とは区別され、まとめて削除できます。</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <ActionForm action={loadDemoAction}><SubmitButton variant="outline" size="sm">サンプルデータを入れる</SubmitButton></ActionForm>
            {demoCount > 0 && <ActionForm action={clearDemoAction}><SubmitButton variant="ghost" size="sm" className="text-destructive">サンプルデータを削除</SubmitButton></ActionForm>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="size-4" />スマホから使う・公開するとき</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>このアプリは、PC上で1人で使う前提です。同じWi-Fi（LAN）内のスマホからは <code className="rounded bg-muted px-1">http://PCのIPアドレス:3000</code> で開けます。</p>
            <p><strong>インターネットに公開する場合</strong>は、少なくとも次の対策が必要です。</p>
            <ul className="list-disc pl-5">
              <li>ログイン（.env の <code className="rounded bg-muted px-1">APP_PASSWORD</code> を設定するとパスワードが必要になります）</li>
              <li>HTTPS（暗号化通信）</li>
              <li>データの永続保存とバックアップ（サーバーのファイルが消えない環境）</li>
              <li>ローカルAIは公開サーバーでは常時動かない前提で設計しています</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
