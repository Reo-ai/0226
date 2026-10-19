import { ctr } from "./metrics";
import type { CandidateTask, Phase } from "./planner";

/** 初月5万円チャレンジの30日プラン（指示書 10章） */
export function challengePlan(): Phase[] {
  return [
    {
      no: 1, title: "収益導線の整備", startDay: 0, endDay: 6, goal: "誰に・何を・どこから買ってもらうかを決め、リンクまでの道を通す",
      milestones: [
        { key: "assessment", title: "アカウント診断", href: "/accounts/assessment" },
        { key: "offers3", title: "案件を3件以上比較", href: "/offers/compare" },
        { key: "approved", title: "紹介する案件と提携", href: "/offers" },
        { key: "link", title: "計測リンクをプロフィール等に設置", href: "/offers" },
      ],
    },
    {
      no: 2, title: "コンテンツ制作", startDay: 7, endDay: 13, goal: "案件を紹介するコンテンツを公開し、初期反応を計測する",
      milestones: [
        { key: "pub5", title: "紹介コンテンツを5本公開", href: "/content" },
        { key: "records", title: "成果記録を7日分つける", href: "/analytics" },
      ],
    },
    {
      no: 3, title: "改善", startDay: 14, endDay: 20, goal: "クリック率・成約率を見て、CTAと案件を見直す",
      milestones: [
        { key: "pub12", title: "公開コンテンツを12本に", href: "/content" },
        { key: "first-conversion", title: "初の成約（発生）を記録", href: "/analytics" },
      ],
    },
    {
      no: 4, title: "成果のある施策に集中", startDay: 21, endDay: 29, goal: "反応の良かったテーマ・案件に時間を寄せ、次月の計画を作る",
      milestones: [
        { key: "first-confirmed", title: "確定報酬を記録", href: "/analytics" },
        { key: "target", title: "月の確定報酬が目標に到達", href: "/analytics" },
      ],
    },
  ];
}

type DayTask = Omit<CandidateTask, "ruleKey">;

/** 週ごとの作業（指示書 10章の30日プラン）。日ごとに分けて「今日のタスク」に入れる */
const WEEK_TASKS: DayTask[][] = [
  [
    { title: "アカウント戦闘力診断を実行する", description: "集客力・導線・成約実績を確認し、改善点を3つ把握します。", estimatedMinutes: 15, priority: 1, relatedFeature: "/accounts/assessment" },
    { title: "ターゲット（誰の・どんな悩み）を1行で書く", description: "フォロワーの属性と、よく反応がある投稿から逆算します。", estimatedMinutes: 20, priority: 1, relatedFeature: "/challenge" },
    { title: "候補案件を比較し、紹介する1〜2件を決める", description: "1件あたりの確定報酬・承認率・ターゲットとの相性で比べます。", estimatedMinutes: 30, priority: 1, relatedFeature: "/offers/compare" },
    { title: "プロフィール文とリンク先を整える", description: "「誰向けに何を発信しているか」と、リンク先で何が得られるかを一目で分かるように。", estimatedMinutes: 30, priority: 2, relatedFeature: "/academy/sales" },
    { title: "リンク導線を自分でクリックして確認する", description: "プロフィール → リンク → 商品ページまで迷わず進めるか、スマホで確認します。", estimatedMinutes: 15, priority: 2, relatedFeature: "/offers" },
  ],
  [
    { title: "今週の投稿テーマを5つ決める", description: "反応が良かった過去投稿のテーマ × 案件で解決できる悩み。", estimatedMinutes: 20, priority: 1, relatedFeature: "/content" },
    { title: "紹介コンテンツを1本作る", description: "コンテンツ工房で下書き → チェック → 公開。", estimatedMinutes: 45, priority: 1, relatedFeature: "/content" },
    { title: "動画台本を1本作る", description: "冒頭2秒のフックと、最後のCTA（プロフィールへの誘導）を必ず入れます。", estimatedMinutes: 30, priority: 2, relatedFeature: "/content" },
    { title: "公開したコンテンツのURLを記録する", description: "投稿ごとの成果を追えるようにします。", estimatedMinutes: 10, priority: 2, relatedFeature: "/content" },
    { title: "昨日の表示回数・クリック数を記録する", description: "初期反応を計測します。分からない値は空欄（未計測）でOK。", estimatedMinutes: 10, priority: 2, relatedFeature: "/analytics" },
  ],
  [
    { title: "投稿ごとのクリック率を確認する", description: "収益分析でCTRの低い投稿を探します。", estimatedMinutes: 15, priority: 1, relatedFeature: "/analytics" },
    { title: "ASPで成約状況（発生・否認）を確認して記録する", description: "発生報酬と確定報酬は分けて記録します。", estimatedMinutes: 15, priority: 1, relatedFeature: "/analytics" },
    { title: "クリック率の低い投稿のCTAを書き直す", description: "コンテンツ工房の「CTA文案」で3案作り、1つ試します。", estimatedMinutes: 30, priority: 2, relatedFeature: "/content" },
    { title: "反応の良い投稿の型で1本作る", description: "当たった投稿の構成を流用し、切り口だけ変えます。", estimatedMinutes: 45, priority: 2, relatedFeature: "/content" },
    { title: "案件を再評価する", description: "クリックはあるのに成約しない案件は、ターゲットとずれている可能性があります。", estimatedMinutes: 20, priority: 3, relatedFeature: "/offers/compare" },
  ],
  [
    { title: "案件別・媒体別の成果を比較する", description: "確定報酬と作業時間あたりの成果で、集中先を決めます。", estimatedMinutes: 20, priority: 1, relatedFeature: "/analytics" },
    { title: "成果の出たテーマで1本作る", description: "有効だったテーマを別の角度で再利用します。", estimatedMinutes: 45, priority: 1, relatedFeature: "/content" },
    { title: "反応の弱い投稿を1つ改善する", description: "冒頭・CTA・リンク位置のどれか1つだけ変えて比べます。", estimatedMinutes: 30, priority: 2, relatedFeature: "/content" },
    { title: "逆算シミュレーターで収益予測を見直す", description: "実績のCTR・CVRで再計算し、来月の必要量を確認します。", estimatedMinutes: 15, priority: 2, relatedFeature: "/challenge" },
    { title: "次月の計画を作る", description: "週次レポートを見て、続ける施策・やめる施策を決めます。", estimatedMinutes: 30, priority: 3, relatedFeature: "/automation" },
  ],
];

/** チャレンジ day（0〜29）の候補タスク。週の作業を日ごとに巡回させる */
export function challengeDailyTasks(dayIndex: number): CandidateTask[] {
  if (dayIndex < 0 || dayIndex > 29) return [];
  const week = Math.min(3, Math.floor(dayIndex / 7));
  const list = WEEK_TASKS[week];
  const dayInWeek = dayIndex - week * 7;
  // 週の最初の日は優先度1の作業を全部、以降は1日2〜3個ずつずらして入れる
  const picked = dayInWeek === 0 ? list.filter((t) => t.priority === 1) : [list[dayInWeek % list.length], list[(dayInWeek + 2) % list.length]];
  return picked.map((t, i) => ({ ...t, ruleKey: `ch:${dayIndex}:${i}:${t.title}` }));
}

export type ReadinessInput = {
  platform: string;
  followerCount: number | null;
  impressions30d: number | null;
  clicks30d: number | null;
  conversions30d: number | null;
  hasOffer: boolean;
  commissionPerApproval: number | null;
};

export type Readiness = { code: "ready" | "funnel" | "traffic" | "offer" | "track"; reasons: string[] };

/** 30日の表示回数の目安（これ未満は集客データ不足とみなす） */
const TRAFFIC_MIN: Record<string, number> = { blog: 3000, instagram: 10000, x: 20000, tiktok: 20000, youtube: 10000 };

/**
 * 収益化の準備状況を判定する。フォロワー数だけでは判定しない（表示回数・クリック・成約を見る）。
 */
export function diagnoseReadiness(i: ReadinessInput): Readiness {
  const reasons: string[] = [];
  const min = TRAFFIC_MIN[i.platform] ?? 10000;
  if (i.impressions30d === null) {
    reasons.push("直近30日の表示回数が未入力のため、集客力を判断できません");
    return { code: "traffic", reasons };
  }
  if (i.impressions30d < min) {
    reasons.push(`直近30日の表示回数が${min.toLocaleString()}回未満です（フォロワー数ではなく、実際に見られている回数で判断します）`);
    return { code: "traffic", reasons };
  }
  if (!i.hasOffer || !i.commissionPerApproval) {
    reasons.push("紹介する案件と、1件あたりの確定報酬が決まっていません");
    return { code: "offer", reasons };
  }
  const rate = ctr(i.clicks30d, i.impressions30d);
  if (rate === null) {
    reasons.push("リンククリック数が未計測です。まずクリックを計測できる導線を作りましょう");
    return { code: "funnel", reasons };
  }
  if (rate < 0.003) {
    reasons.push(`クリック率が${(rate * 100).toFixed(2)}%と低く、見られていてもリンクまで届いていません`);
    return { code: "funnel", reasons };
  }
  if (i.conversions30d === null || i.conversions30d === 0) {
    reasons.push("成約実績がまだありません。小さく紹介して、成約するかを確かめる段階です");
    return { code: "track", reasons };
  }
  reasons.push("集客・導線・成約実績がそろっています。紹介量を増やす段階です");
  return { code: "ready", reasons };
}
