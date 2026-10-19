import { z } from "zod";
import { dataBlock, runAI } from "./ai";
import { prisma } from "./db";
import { candidateTasks } from "./planner";
import { plannerState } from "./state";

type Profile = NonNullable<Awaited<ReturnType<typeof prisma.profile.findFirst>>>;

export const coachAnswerSchema = z.object({
  answer: z.string().min(1).max(2000),
  nextActions: z.array(z.string().max(120)).max(5),
  facts: z.array(z.string().max(200)).max(8),
  hypotheses: z.array(z.string().max(200)).max(8),
});
export type CoachAnswer = z.infer<typeof coachAnswerSchema>;

/** AIコーチへの質問。AIなしの場合は状況から決まった助言を返す */
export async function askCoach(profile: Profile, question: string) {
  const state = await plannerState(profile);
  const result = await runAI({
    system: "あなたはアフィリエイト初心者を伴走するAIコーチです。質問に、今の進捗と実績を踏まえて具体的に答えます。",
    prompt: [
      "質問に答え、次にやる行動を最大5つ挙げてください。",
      "facts には下の状況データから読み取れる事実だけを、hypotheses にはデータにない推測を書くこと。",
      dataBlock("状況", state),
      dataBlock("質問", question),
    ].join("\n\n"),
    schema: coachAnswerSchema,
    fallback: () => ruleAnswer(state),
  });
  await prisma.aIRecommendation.create({
    data: {
      recommendationType: "coach",
      title: question.slice(0, 80),
      description: result.data.answer,
      evidence: JSON.stringify({ facts: result.data.facts, hypotheses: result.data.hypotheses, nextActions: result.data.nextActions }),
      priority: 3,
      status: "done",
      generatedBy: result.generatedBy,
    },
  });
  return result;
}

function ruleAnswer(state: Awaited<ReturnType<typeof plannerState>>): CoachAnswer {
  const tasks = candidateTasks(state).sort((a, b) => a.priority - b.priority).slice(0, 3);
  const c = state.counts;
  const facts = [
    `経過日数: ${state.dayIndex}日`,
    `登録案件: ${c.offers}件（提携済み ${c.approvedOffers}件）`,
    `公開コンテンツ: ${c.publications}本（直近7日 ${c.publicationsLast7d}本）`,
    `成果記録: ${c.performanceRecords}件`,
    `今月の確定報酬: ${state.confirmedThisMonth === null ? "未計測" : `${state.confirmedThisMonth.toLocaleString()}円`}`,
  ];
  let answer = "AIに接続していないため、今の進捗から決まった助言を表示しています。";
  if (c.offers === 0) answer += "まずは紹介する案件を決めましょう。案件が決まると、作るべきコンテンツも決まります。";
  else if (c.publications === 0) answer += "案件は登録できています。次は1本目のコンテンツを公開するのが最優先です。完璧より公開を優先しましょう。";
  else if (c.recordsLast7d === 0) answer += "公開は進んでいます。数字を記録しないと改善できないので、表示回数・クリック・成果を記録しましょう。";
  else answer += "記録が取れています。収益分析でクリック率・成約率の低いところを1つ選んで改善しましょう。";
  return { answer, nextActions: tasks.map((t) => t.title), facts, hypotheses: [] };
}
