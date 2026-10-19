/**
 * ルールベースの計画ロジック（AIなしでも動く部分）。DB に依存しない純粋関数なので単体テストできる。
 */
import { challengeDailyTasks } from "./challenge";

export type PlannerState = {
  experienceLevel: string;
  dailyWorkMinutes: number;
  platforms: string[];
  challengeMode: boolean;
  dayIndex: number; // 開始日を 0 とした経過日数
  /** 初月5万円チャレンジ中なら開始日からの日数（0〜29）、それ以外は null */
  challengeDay: number | null;
  counts: {
    channels: number;
    assessments: number;
    offers: number;
    approvedOffers: number;
    trackingLinks: number;
    drafts: number;
    publications: number;
    publicationsLast7d: number;
    performanceRecords: number;
    recordsLast7d: number;
    lessonsCompleted: number;
    completedCourses: string[];
  };
  /** 今月の確定報酬（未計測なら null） */
  confirmedThisMonth: number | null;
  targetMonthlyRevenue: number;
};

export type CandidateTask = {
  ruleKey: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  priority: number; // 1（最優先）〜5
  relatedFeature: string;
};

const today = (s: PlannerState) => `d${s.dayIndex}`;

/** 状況から「今やるべき候補タスク」を列挙する */
export function candidateTasks(s: PlannerState): CandidateTask[] {
  const c = s.counts;
  const out: CandidateTask[] = [];
  const add = (t: CandidateTask) => out.push(t);
  const mainPlatform = s.platforms[0] ?? "blog";

  // チャレンジ中は30日プランの作業を最優先で入れる
  if (s.challengeDay !== null) out.push(...challengeDailyTasks(s.challengeDay));

  // 1. 土台
  if (!c.completedCourses.includes("asp")) {
    add({ ruleKey: "learn:asp", title: "攻略大学「ASP完全攻略」を1レッスン進める", description: "ASPの仕組みと提携の流れを理解すると、案件選びで迷わなくなります。", estimatedMinutes: 20, priority: 1, relatedFeature: "/academy/asp" });
  }
  if (c.channels === 0) {
    add({ ruleKey: "setup:channel", title: "使っているブログ・SNSアカウントを登録する", description: "数字が分かる範囲で入力。分からない項目は空欄でOK（未計測として扱います）。", estimatedMinutes: 10, priority: 1, relatedFeature: "/accounts" });
  } else if (c.assessments === 0) {
    add({ ruleKey: "setup:assessment", title: "アカウント戦闘力診断を実行する", description: "集客力・導線・成約実績から、優先すべき改善を3つ出します。", estimatedMinutes: 10, priority: 1, relatedFeature: "/accounts/assessment" });
  }

  // 2. 案件
  if (c.offers < 3) {
    add({ ruleKey: "offers:register", title: `ASPで案件を探し、候補を${3 - c.offers}件登録する`, description: "報酬額・成果条件・否認条件はASPの画面で確認した値だけを入力します。", estimatedMinutes: 25, priority: 2, relatedFeature: "/offers" });
  } else if (c.approvedOffers === 0) {
    add({ ruleKey: "offers:apply", title: "候補案件に提携申請し、結果を記録する", description: "提携が承認されるまで数日かかることがあります。承認後に広告リンクを取得します。", estimatedMinutes: 15, priority: 2, relatedFeature: "/offers" });
  }
  if (c.approvedOffers > 0 && c.trackingLinks === 0) {
    add({ ruleKey: "offers:link", title: "提携済み案件の計測リンクを作る", description: "どの媒体からクリックされたかが分かるようになります。", estimatedMinutes: 10, priority: 2, relatedFeature: "/offers" });
  }

  // 3. 発信（毎日の作業）
  if (c.offers > 0) {
    add({ ruleKey: `content:${today(s)}`, title: `${platformName(mainPlatform)}の投稿・記事を1本作る`, description: "コンテンツ工房で下書き → 広告表示と事実確認のチェック → 公開。", estimatedMinutes: mainPlatform === "blog" ? 60 : 40, priority: 2, relatedFeature: "/content" });
  }
  if (c.drafts > c.publications) {
    add({ ruleKey: `publish:${today(s)}`, title: "確認済みの下書きを公開し、URLを記録する", description: "公開URLを記録すると、投稿ごとの成果を追えます。", estimatedMinutes: 15, priority: 2, relatedFeature: "/content" });
  }

  // 4. 計測・改善
  if (c.publications > 0) {
    add({ ruleKey: `record:${today(s)}`, title: "昨日の表示回数・クリック・成果を記録する", description: "ASPと各SNSの管理画面から転記。分からない値は空欄（未計測）のままでOK。", estimatedMinutes: 10, priority: c.recordsLast7d === 0 ? 2 : 3, relatedFeature: "/analytics" });
  }
  if (s.dayIndex > 0 && s.dayIndex % 7 === 0) {
    add({ ruleKey: `weekly:${today(s)}`, title: "週次レポートで1週間を振り返る", description: "伸びた投稿・伸びなかった投稿を比べ、来週の優先行動を決めます。", estimatedMinutes: 20, priority: 2, relatedFeature: "/automation" });
  }

  // 学習（空き時間の穴埋め）
  if (c.lessonsCompleted < 40) {
    add({ ruleKey: `learn:${today(s)}`, title: "攻略大学で1レッスン学ぶ", description: "今の段階に合った講座から進めましょう。", estimatedMinutes: 15, priority: 4, relatedFeature: "/academy" });
  }

  // 目標との差が大きいときは改善を優先
  const gap = s.confirmedThisMonth === null ? null : s.targetMonthlyRevenue - s.confirmedThisMonth;
  if (s.challengeMode && c.recordsLast7d > 0 && gap !== null && gap > 0) {
    add({ ruleKey: `improve:${today(s)}`, title: "クリック率・成約率が低い投稿を1つ改善する", description: "CTA（行動を促す一文）やリンク位置を変えて、数字の変化を見ます。", estimatedMinutes: 25, priority: 2, relatedFeature: "/analytics" });
  }
  return out;
}

function platformName(p: string) {
  return ({ blog: "ブログ", instagram: "Instagram", x: "X", tiktok: "TikTok", youtube: "YouTube" } as Record<string, string>)[p] ?? p;
}

export type Selectable = { id?: string; priority: number; estimatedMinutes: number; dueDate?: Date | null };

/**
 * 優先度スコア（小さいほど先にやる）。期限が近い・過ぎているタスクを前に出す。
 */
export function priorityScore(t: Selectable, now: Date): number {
  let score = t.priority * 10;
  if (t.dueDate) {
    const days = (t.dueDate.getTime() - now.getTime()) / 86_400_000;
    if (days < 0) score -= 8;
    else if (days < 1) score -= 5;
    else if (days < 3) score -= 2;
  }
  // 同じ優先度なら短いタスクを先に（着手しやすさ）
  return score + Math.min(t.estimatedMinutes, 120) / 120;
}

/**
 * 作業可能時間に収まるようにタスクを選ぶ。優先度順に詰め、入らないものは飛ばす。
 * 合計は必ず budgetMinutes 以下になる。
 */
export function selectWithinBudget<T extends Selectable>(tasks: T[], budgetMinutes: number, now = new Date()): T[] {
  const sorted = [...tasks].sort((a, b) => priorityScore(a, now) - priorityScore(b, now));
  const picked: T[] = [];
  let used = 0;
  for (const t of sorted) {
    if (t.estimatedMinutes <= 0) continue;
    if (used + t.estimatedMinutes > budgetMinutes) continue;
    picked.push(t);
    used += t.estimatedMinutes;
  }
  return picked;
}

// ---- 90日ロードマップ ----

export type Milestone = { key: string; title: string; href: string };
export type Phase = { no: number; title: string; startDay: number; endDay: number; goal: string; milestones: Milestone[] };

export function roadmap90(): Phase[] {
  return [
    {
      no: 1, title: "土台づくり", startDay: 0, endDay: 13, goal: "ASPの仕組みを理解し、発信するアカウントの現状を把握する",
      milestones: [
        { key: "course-asp", title: "攻略大学「ASP完全攻略」を修了", href: "/academy/asp" },
        { key: "channel", title: "アカウントを登録", href: "/accounts" },
        { key: "assessment", title: "戦闘力診断を実行", href: "/accounts/assessment" },
      ],
    },
    {
      no: 2, title: "案件選定と導線づくり", startDay: 14, endDay: 29, goal: "紹介する案件を決めて提携し、クリックを計測できる状態にする",
      milestones: [
        { key: "offers5", title: "候補案件を5件登録して比較", href: "/offers/compare" },
        { key: "approved", title: "1件以上の案件と提携", href: "/offers" },
        { key: "link", title: "計測リンクを作成", href: "/offers" },
      ],
    },
    {
      no: 3, title: "発信と計測", startDay: 30, endDay: 59, goal: "コンテンツを継続して公開し、数字を記録する習慣をつくる",
      milestones: [
        { key: "pub10", title: "コンテンツを10本公開", href: "/content" },
        { key: "records", title: "成果記録を7日分以上つける", href: "/analytics" },
        { key: "course-sales", title: "攻略大学「セールス・成約率攻略」を修了", href: "/academy/sales" },
      ],
    },
    {
      no: 4, title: "改善と集中", startDay: 60, endDay: 89, goal: "成果の出た案件・テーマに時間を集中し、月5万円に近づける",
      milestones: [
        { key: "pub30", title: "コンテンツを30本公開", href: "/content" },
        { key: "first-confirmed", title: "初の確定報酬を記録", href: "/analytics" },
        { key: "target", title: "月の確定報酬が目標に到達", href: "/analytics" },
      ],
    },
  ];
}

export type MilestoneFacts = {
  completedCourses: string[];
  channels: number;
  assessments: number;
  offers: number;
  approvedOffers: number;
  trackingLinks: number;
  publications: number;
  recordDays: number;
  conversionsTotal: number | null;
  confirmedTotal: number | null;
  bestMonthConfirmed: number | null;
  target: number;
};

export function milestoneDone(key: string, f: MilestoneFacts): boolean {
  switch (key) {
    case "course-asp": return f.completedCourses.includes("asp");
    case "course-sales": return f.completedCourses.includes("sales");
    case "channel": return f.channels > 0;
    case "assessment": return f.assessments > 0;
    case "offers3": return f.offers >= 3;
    case "offers5": return f.offers >= 5;
    case "approved": return f.approvedOffers > 0;
    case "link": return f.trackingLinks > 0;
    case "pub5": return f.publications >= 5;
    case "pub10": return f.publications >= 10;
    case "pub12": return f.publications >= 12;
    case "pub30": return f.publications >= 30;
    case "records": return f.recordDays >= 7;
    case "first-conversion": return (f.conversionsTotal ?? 0) > 0;
    case "first-confirmed": return (f.confirmedTotal ?? 0) > 0;
    case "target": return (f.bestMonthConfirmed ?? 0) >= f.target;
    default: return false;
  }
}

/** 現在のフェーズ（経過日数から） */
export function currentPhase(phases: Phase[], dayIndex: number): Phase {
  return phases.find((p) => dayIndex >= p.startDay && dayIndex <= p.endDay) ?? phases[phases.length - 1];
}
