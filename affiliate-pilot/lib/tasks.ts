import { z } from "zod";
import { dataBlock, runAI, type AIResult } from "./ai";
import { prisma } from "./db";
import { jstDay } from "./format";
import { candidateTasks, selectWithinBudget } from "./planner";
import { plannerState } from "./state";

type Profile = NonNullable<Awaited<ReturnType<typeof prisma.profile.findFirst>>>;

/**
 * ワークフローA：毎日の作業計画
 * 目標と実績を読み込み → 未完了タスクを確認 → 優先順位を計算 → 作業可能時間内で選択 → 今日のタスクに設定
 */
export async function planToday(profile: Profile, now = new Date()) {
  const day = jstDay(now);
  const state = await plannerState(profile, now);

  // 既存の未完了タスク（手動・AI・持ち越し）
  const open = await prisma.task.findMany({ where: { profileId: profile.id, status: "todo" } });
  const openKeys = new Set(open.map((t) => t.ruleKey).filter(Boolean));
  const doneKeys = new Set(
    (await prisma.task.findMany({ where: { profileId: profile.id, status: { not: "todo" }, ruleKey: { not: null } }, select: { ruleKey: true } })).map((t) => t.ruleKey),
  );

  // ルールの候補のうち、まだ無いもの
  const fresh = candidateTasks(state).filter((c) => !openKeys.has(c.ruleKey) && !doneKeys.has(c.ruleKey));
  const pool = [
    ...open.map((t) => ({ ...t, kind: "existing" as const })),
    ...fresh.map((c) => ({ ...c, id: undefined, dueDate: null, kind: "new" as const })),
  ];
  const picked = selectWithinBudget(pool, profile.dailyWorkMinutes, now);
  const pickedIds = new Set(picked.flatMap((p) => (p.kind === "existing" ? [p.id] : [])));

  await prisma.$transaction([
    // 今日に入らなかった既存タスクは「今日の予定」から外す（未完了のまま残る）
    prisma.task.updateMany({ where: { profileId: profile.id, status: "todo", taskDate: day, id: { notIn: [...pickedIds] } }, data: { taskDate: null } }),
    prisma.task.updateMany({ where: { id: { in: [...pickedIds] } }, data: { taskDate: day } }),
    ...picked
      .filter((p) => p.kind === "new")
      .map((p) =>
        prisma.task.create({
          data: {
            profileId: profile.id,
            title: p.title,
            description: p.description,
            priority: p.priority,
            estimatedMinutes: p.estimatedMinutes,
            relatedFeature: p.relatedFeature,
            ruleKey: p.ruleKey,
            source: "rule",
            taskDate: day,
          },
        }),
      ),
  ]);
}

export async function todayTasks(profileId: string, now = new Date()) {
  return prisma.task.findMany({
    where: { profileId, taskDate: jstDay(now) },
    orderBy: [{ status: "asc" }, { priority: "asc" }, { createdAt: "asc" }],
  });
}

/** 今日のタスクがまだ1つも無ければ自動で計画する */
export async function ensureToday(profile: Profile, now = new Date()) {
  const n = await prisma.task.count({ where: { profileId: profile.id, taskDate: jstDay(now) } });
  if (n === 0) await planToday(profile, now);
  return todayTasks(profile.id, now);
}

const aiTasksSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().min(2).max(80),
        description: z.string().max(300),
        estimatedMinutes: z.number().int().min(5).max(180),
        priority: z.number().int().min(1).max(5),
        // 作業する画面のパス（アプリ内のみ）
        relatedFeature: z.string().regex(/^\/[a-z0-9/-]*$/, "アプリ内のパスを指定してください").max(60),
      }),
    )
    .min(1)
    .max(8),
  reason: z.string().max(400),
});

/** 戦略AI：進捗と実績を踏まえて今日のタスクを組み直す（AIなしならルールのまま） */
export async function aiAdjustToday(profile: Profile, note: string, now = new Date()): Promise<AIResult<z.infer<typeof aiTasksSchema>>> {
  const state = await plannerState(profile, now);
  const rule = candidateTasks(state);
  const result = await runAI({
    system: "あなたはアフィリエイト初心者を伴走する戦略AIです。ユーザーの状況から、今日やるべき具体的な作業を優先度順に提案します。",
    prompt: [
      `1日の作業可能時間は${profile.dailyWorkMinutes}分。合計がこれを超えないように、5〜180分の作業を選ぶこと。`,
      "ルールで作った候補を参考に、状況に合わせて追加・削除・言い換えてよい。relatedFeature は作業する画面のパス。",
      dataBlock("状況", state),
      dataBlock("ルールで作った候補", rule),
      note ? dataBlock("ユーザーからの希望", note) : "",
    ].join("\n\n"),
    schema: aiTasksSchema,
    fallback: () => ({ tasks: rule.map(({ ruleKey: _k, ...t }) => t).slice(0, 8), reason: "ルールベースで作成しました" }),
  });

  const day = jstDay(now);
  // 手動で入れたタスクは残し、その時間を差し引いた残りにAIの提案を詰める
  const kept = await prisma.task.findMany({ where: { profileId: profile.id, taskDate: day, NOT: { status: "todo", source: { in: ["rule", "ai"] } } } });
  const budget = profile.dailyWorkMinutes - kept.reduce((m, t) => m + t.estimatedMinutes, 0);
  const picked = selectWithinBudget(result.data.tasks, Math.max(0, budget), now);
  await prisma.$transaction([
    // 今日の自動生成タスクは置き換える（ルールのタスクは削除しても、条件が残っていれば後日また提案される）
    prisma.task.deleteMany({ where: { profileId: profile.id, status: "todo", taskDate: day, source: { in: ["rule", "ai"] } } }),
    ...picked.map((t) =>
      prisma.task.create({ data: { profileId: profile.id, ...t, source: result.generatedBy === "fallback" ? "rule" : "ai", taskDate: day } }),
    ),
  ]);
  return result;
}
