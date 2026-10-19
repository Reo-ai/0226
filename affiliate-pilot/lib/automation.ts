import { z } from "zod";
import { AICancelledError, dataBlock, runAI } from "./ai";
import { groupTotals, totalsBetween } from "./analytics";
import { platformLabel, type ContentType } from "./constants";
import { generateContent, lintContent, platformOf } from "./content";
import { prisma } from "./db";
import { addDays, jstDay, minutesLabel, pct, yen } from "./format";
import { rates, type Totals } from "./metrics";
import { getProfile } from "./profile";
import { contentInputsSchema } from "./schemas";
import { planToday } from "./tasks";

export const JOB_TYPES = {
  daily_tasks: "日次タスク生成",
  content_draft: "コンテンツ下書き生成",
  performance_rollup: "成果集計",
  improvement: "改善案生成",
  weekly_report: "週次レポート",
} as const;
export type JobType = keyof typeof JOB_TYPES;

type Log = (action: string, result: string) => Promise<void>;

/** 実行中ジョブのキャンセル用（このサーバープロセス内で管理） */
const g = globalThis as unknown as { __jobControllers?: Map<string, AbortController> };
const controllers = (g.__jobControllers ??= new Map());

/** 実行中かどうか（開始済み・未完了・キャンセル可能） */
export function isRunning(jobId: string) {
  return controllers.has(jobId);
}

export function cancelJob(jobId: string): boolean {
  const c = controllers.get(jobId);
  if (!c) return false;
  c.abort();
  return true;
}

/**
 * ジョブを作成して実行する。失敗しても例外は投げず、failed として記録する。
 * background: true なら完了を待たずにIDを返す（AIの応答を待つ間も他の画面を操作できる）
 */
export async function runJob(jobType: JobType, payload: Record<string, unknown> = {}, opts: { background?: boolean } = {}) {
  const job = await prisma.automationJob.create({ data: { name: JOB_TYPES[jobType], jobType, payload: JSON.stringify(payload), status: "draft", startedAt: new Date() } });
  const controller = new AbortController();
  controllers.set(job.id, controller);
  const log: Log = async (action, result) => {
    await prisma.automationLog.create({ data: { automationJobId: job.id, action, result: result.slice(0, 4000) } });
  };
  const work = (async () => {
    try {
      const { status, result } = await RUNNERS[jobType](payload, log, controller.signal);
      if (controller.signal.aborted) throw new AICancelledError();
      await prisma.automationJob.update({ where: { id: job.id }, data: { status, result: JSON.stringify(result), completedAt: status === "completed" ? new Date() : null } });
    } catch (e) {
      const cancelled = e instanceof AICancelledError || controller.signal.aborted;
      const message = cancelled ? "ユーザーがキャンセルしました" : e instanceof Error ? e.message : String(e);
      await log(cancelled ? "キャンセル" : "エラー", message);
      await prisma.automationJob.update({ where: { id: job.id }, data: { status: "failed", errorMessage: message.slice(0, 1000), completedAt: new Date() } });
    } finally {
      controllers.delete(job.id);
    }
  })();
  if (!opts.background) await work;
  return job.id;
}

/** 同じ種類・同じ入力でもう一度実行する */
export async function rerunJob(jobId: string, opts: { background?: boolean } = {}) {
  const job = await prisma.automationJob.findUnique({ where: { id: jobId } });
  if (!job || !(job.jobType in JOB_TYPES)) throw new Error("ジョブが見つかりません");
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(job.payload);
  } catch {
    payload = {};
  }
  return runJob(job.jobType as JobType, payload, opts);
}

type RunResult = { status: "completed" | "awaiting_review"; result: unknown };
const RUNNERS: Record<JobType, (payload: Record<string, unknown>, log: Log, signal: AbortSignal) => Promise<RunResult>> = {
  // ワークフローA：毎日の作業計画
  async daily_tasks(_, log) {
    const profile = await getProfile();
    if (!profile) throw new Error("初期設定がまだです");
    await log("読み込み", "目標・実績・未完了タスクを読み込みました");
    await planToday(profile);
    const tasks = await prisma.task.findMany({ where: { profileId: profile.id, taskDate: jstDay() }, orderBy: { priority: "asc" } });
    const total = tasks.reduce((m, t) => m + t.estimatedMinutes, 0);
    await log("選択", `${tasks.length}件・合計${minutesLabel(total)}（作業可能時間 ${minutesLabel(profile.dailyWorkMinutes)}）`);
    return { status: "completed", result: { tasks: tasks.map((t) => ({ title: t.title, minutes: t.estimatedMinutes })) } };
  },

  // ワークフローB：コンテンツ制作（下書き → ユーザー確認待ち）
  async content_draft(payload, log, signal) {
    const type = String(payload.contentType ?? "instagram_post") as ContentType;
    const offer = payload.offerId ? await prisma.affiliateOffer.findUnique({ where: { id: String(payload.offerId) } }) : null;
    if (payload.offerId && !offer) throw new Error("案件が見つかりません。削除された可能性があります");
    // コンテンツ工房から渡された入力があれば使い、なければ案件の情報から作る
    const given = contentInputsSchema.safeParse(payload.inputs ?? {});
    const inputs = contentInputsSchema.parse({
      ...(given.success ? given.data : {}),
      product: (given.success && given.data.product) || offer?.name || "",
      genre: (given.success && given.data.genre) || offer?.category || "",
      target: (given.success && given.data.target) || offer?.targetAudience || "",
      evidence: (given.success && given.data.evidence) || offer?.notes || "",
    });
    if (!inputs.product) throw new Error("案件を選ぶか、商品名を入力してください");
    await log("入力", `${inputs.product}（${type}）`);
    await log("生成", "AIに下書きを依頼しました（ローカルAIは1〜2分かかることがあります）");
    const r = await generateContent(type, inputs, offer ? { name: offer.name, conversionConditions: offer.conversionConditions, notes: offer.notes } : null, null, signal);
    if (r.warning) await log("AI", r.warning);
    const lint = lintContent(`${r.data.title}\n${r.data.body}`);
    const draft = await prisma.contentDraft.create({
      data: {
        platform: String(payload.platform || "") || platformOf(type) || "blog",
        contentType: type, title: r.data.title, body: r.data.body, cta: r.data.cta, inputs: JSON.stringify(inputs),
        checks: JSON.stringify({ adDisclosure: false, userReviewed: false, facts: [...r.data.factCheckItems, ...lint.issues.map((x) => `注意表現：${x}`)].map((item) => ({ item, checked: false })) }),
        affiliateOfferId: offer?.id ?? null, status: "awaiting_review", generatedBy: r.generatedBy === "fallback" ? "template" : r.generatedBy,
      },
    });
    await log("下書き", `「${draft.title}」を作成しました。公開前にコンテンツ工房で確認してください`);
    return { status: "awaiting_review", result: { draftId: draft.id, title: draft.title } };
  },

  async performance_rollup(_, log) {
    const from = addDays(jstDay(), -29);
    const [t, groups, count] = await Promise.all([totalsBetween(from), groupTotals("platform", from), prisma.performanceRecord.count({ where: { recordDate: { gte: from } } })]);
    const byPlatform = groups.map((g) => ({ platform: platformLabel(g.key), ...g.totals }));
    await log("集計", `直近30日 ${count}件：確定報酬 ${yen(t.confirmedRevenue)}・発生報酬 ${yen(t.pendingRevenue)}`);
    return { status: "completed", result: { totals: t, rates: rates(t), byPlatform } };
  },

  // ワークフローC：成果改善
  async improvement(_, log, signal) {
    const today = jstDay();
    const [tc, tp, curCount, prevCount] = await Promise.all([
      totalsBetween(addDays(today, -13)),
      totalsBetween(addDays(today, -27), addDays(today, -13)),
      prisma.performanceRecord.count({ where: { recordDate: { gte: addDays(today, -13) } } }),
      prisma.performanceRecord.count({ where: { recordDate: { gte: addDays(today, -27), lt: addDays(today, -13) } } }),
    ]);
    await log("指標", `直近14日 ${curCount}件／その前14日 ${prevCount}件`);
    const facts = factLines(tc, tp);
    const insufficient = curCount < 3 || tc.clicks === null;
    if (insufficient) await log("データ不足", "記録が少ないため、計測を優先する提案にします");
    const rule = ruleSuggestions(tc, insufficient);
    const ai = await runAI({
      system: "あなたはアフィリエイトの成果を分析し、改善策を提案する分析AIです。",
      prompt: [
        "直近14日と、その前の14日の実績から改善案を最大5つ作ってください。",
        "facts には下のデータから計算できる事実だけ、hypotheses にはデータにない推測を書くこと。データ不足ならまず計測を増やす提案をすること。",
        dataBlock("直近14日", { ...tc, ...rates(tc) }),
        dataBlock("その前14日", { ...tp, ...rates(tp) }),
        dataBlock("ルールによる候補", rule),
      ].join("\n\n"),
      schema: improvementSchema,
      fallback: () => ({ facts, hypotheses: [], suggestions: rule }),
      signal,
    });
    if (ai.warning) await log("AI", ai.warning);
    await log("改善案", `${ai.data.suggestions.length}件を作成しました（承認すると提案とタスクに反映）`);
    return { status: "awaiting_review", result: { ...ai.data, generatedBy: ai.generatedBy } };
  },

  // ワークフローD：週次レポート
  async weekly_report(_, log, signal) {
    const profile = await getProfile();
    if (!profile) throw new Error("初期設定がまだです");
    const today = jstDay();
    const weekFrom = addDays(today, -6);
    const [t, rowCount] = await Promise.all([totalsBetween(weekFrom), prisma.performanceRecord.count({ where: { recordDate: { gte: weekFrom } } })]);
    const done = await prisma.task.findMany({ where: { profileId: profile.id, status: "done", completedAt: { gte: weekFrom } }, select: { title: true, estimatedMinutes: true } });
    const pubs = await prisma.publication.count({ where: { publishedAt: { gte: weekFrom } } });
    const taskMinutes = done.reduce((m, x) => m + x.estimatedMinutes, 0);
    await log("集計", `記録${rowCount}件・完了タスク${done.length}件・公開${pubs}本`);
    const issues: string[] = [];
    if (rowCount === 0) issues.push("今週の成果記録がありません");
    if (pubs === 0) issues.push("今週公開したコンテンツがありません");
    if (t.clicks !== null && t.impressions !== null && (rates(t).ctr ?? 0) < 0.005) issues.push(`クリック率が${pct(rates(t).ctr, 2)}と低めです`);
    if (t.clicks !== null && t.clicks >= 50 && (t.conversions ?? 0) === 0) issues.push("クリックはあるのに成約がありません");
    const ai = await runAI({
      system: "あなたはアフィリエイトの週次振り返りを手伝う分析AIです。",
      prompt: ["1週間の実績から、良かった点・課題・翌週の優先行動（3つ）をまとめてください。数字は下のデータにあるものだけを使うこと。", dataBlock("今週", { totals: t, rates: rates(t), completedTasks: done.map((d) => d.title), publications: pubs, issues })].join("\n\n"),
      schema: weeklySchema,
      fallback: () => ({
        summary: `今週は${done.length}件のタスクを完了し、${pubs}本を公開しました。確定報酬は${yen(t.confirmedRevenue)}、発生報酬は${yen(t.pendingRevenue)}です。`,
        good: done.length ? [`タスクを${done.length}件完了（約${minutesLabel(taskMinutes)}）`] : [],
        issues,
        nextWeek: ruleSuggestions(t, rowCount < 3).slice(0, 3).map((s) => s.title),
      }),
      signal,
    });
    if (ai.warning) await log("AI", ai.warning);
    return {
      status: "awaiting_review",
      result: { ...ai.data, period: { from: weekFrom.toISOString(), to: today.toISOString() }, totals: t, workMinutes: t.workMinutes, taskMinutes, completedTasks: done.length, publications: pubs, generatedBy: ai.generatedBy },
    };
  },
};

export const improvementSchema = z.object({
  facts: z.array(z.string().max(200)).max(10),
  hypotheses: z.array(z.string().max(200)).max(10),
  suggestions: z.array(z.object({ title: z.string().max(80), description: z.string().max(400), priority: z.number().int().min(1).max(5), minutes: z.number().int().min(5).max(180) })).max(5),
});

export const weeklySchema = z.object({
  summary: z.string().max(800),
  good: z.array(z.string().max(200)).max(5),
  issues: z.array(z.string().max(200)).max(5),
  nextWeek: z.array(z.string().max(120)).max(5),
});

function change(cur: number | null, prev: number | null) {
  if (cur === null || prev === null || prev === 0) return "";
  const d = (cur - prev) / prev;
  return `（前の14日比 ${d >= 0 ? "+" : ""}${(d * 100).toFixed(0)}%）`;
}

function factLines(c: Totals, p: Totals): string[] {
  const rc = rates(c);
  return [
    `確定報酬 ${yen(c.confirmedRevenue)}${change(c.confirmedRevenue, p.confirmedRevenue)}`,
    `発生報酬 ${yen(c.pendingRevenue)}${change(c.pendingRevenue, p.pendingRevenue)}`,
    `クリック ${c.clicks ?? "未計測"}${change(c.clicks, p.clicks)}`,
    `CTR ${pct(rc.ctr, 2)}・CVR ${pct(rc.cvr, 2)}・承認率 ${pct(rc.approvalRate, 0)}`,
  ];
}

/** ルールによる改善候補（AIなしでも出せる） */
export function ruleSuggestions(t: Totals, insufficient: boolean) {
  const r = rates(t);
  const out: z.infer<typeof improvementSchema>["suggestions"] = [];
  if (insufficient) out.push({ title: "表示回数・クリック・成果を毎日記録する", description: "データが少ないため、改善の判断ができません。まず1週間、数字を記録しましょう。", priority: 1, minutes: 10 });
  if (t.impressions === null) out.push({ title: "表示回数（インプレッション）を記録する", description: "クリック率を計算するために、SNSのインサイトやSearch Consoleの数字を記録します。", priority: 2, minutes: 10 });
  if (r.ctr !== null && r.ctr < 0.005) out.push({ title: "CTAとリンク導線を見直す", description: "見られているのにクリックされていません。投稿の最後に「プロフィールのリンクから」と誘導し、リンク先で何が得られるかを書きます。", priority: 2, minutes: 30 });
  if (r.cvr !== null && r.cvr < 0.01 && (t.clicks ?? 0) >= 50) out.push({ title: "案件とターゲットのずれを確認する", description: "クリックはあるのに成約が少ない状態です。案件の対象ユーザーと発信の読者が合っているか、案件比較で見直します。", priority: 2, minutes: 30 });
  if (r.approvalRate !== null && r.approvalRate < 0.5) out.push({ title: "否認の理由を確認する", description: "承認率が低めです。ASPの否認理由と成果条件を確認し、条件に合う読者に紹介しているか見直します。", priority: 3, minutes: 20 });
  if (out.length < 3) out.push({ title: "成果の出た投稿の型で1本作る", description: "確定報酬やクリックが多かった投稿と同じ構成で、切り口を変えた投稿を作ります。", priority: 3, minutes: 45 });
  if (out.length < 3) out.push({ title: "作業時間あたりの成果を比べる", description: "媒体別・案件別に、作業時間あたりの確定報酬を比べ、時間を寄せる先を決めます。", priority: 4, minutes: 20 });
  return out.slice(0, 5);
}
