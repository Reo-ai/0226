import { all, get } from "./db";

export type GuideStep = {
  id: string;
  phase: string;
  title: string;
  body: string;
  /** データから自動で完了判定できるステップ */
  auto?: () => Promise<boolean>;
  href?: string;
};

const has = async (sql: string) => ((await get<{ n: number }>(sql))?.n ?? 0) > 0;

export const GUIDE: GuideStep[] = [
  {
    id: "niche",
    phase: "1. 土台づくり",
    title: "ジャンル（誰の・どんな悩み）を1つに絞る",
    body: "「30代の筋トレ初心者」「副業を始めたい会社員」のように、発信相手を1人に決めると刺さる投稿が作りやすくなります。報酬が高いジャンル（金融・転職・脱毛・スクール）はライバルも強いので、最初は自分の経験を語れるジャンルを優先。",
  },
  {
    id: "asp",
    phase: "1. 土台づくり",
    title: "ASPに3社以上登録する",
    body: "A8.net・もしもアフィリエイト・バリューコマース・afb・アクセストレードなど。同じ商品でも報酬額や承認率がASPごとに違うので、複数登録して比較できる状態にします。Amazon・楽天はもしも経由だと報酬が上乗せされることも。",
  },
  {
    id: "pr",
    phase: "1. 土台づくり",
    title: "PR表記・法律のルールを確認する",
    body: "2023年10月からステマ規制により広告には「PR」「広告」の明示が必須。サプリ・化粧品は薬機法（「治る」「痩せる」等の効能断定NG）、金融は誇大表現NGに注意。このアプリのAI生成は自動でPR表記を入れます。",
  },
  {
    id: "programs",
    phase: "2. 案件えらび",
    title: "候補案件を5件以上登録してスコアを比較する",
    body: "報酬単価だけでなく「承認率」「CVR」を掛け合わせた想定EPC（1クリックあたりの収益）で比べます。単価1万円・承認率20%より、単価3千円・承認率90%の方が稼げることもよくあります。",
    href: "/programs",
    auto: async () => ((await get<{ n: number }>("SELECT COUNT(*) n FROM programs"))?.n ?? 0) >= 5,
  },
  {
    id: "research",
    phase: "2. 案件えらび",
    title: "AIリサーチで狙う案件と切り口を決める",
    body: "登録した案件と実績データをもとに、AIが「今どれに集中すべきか」「どんな切り口で発信するか」を提案します。",
    href: "/programs",
    auto: () => has("SELECT COUNT(*) n FROM ai_usage WHERE purpose = 'research'"),
  },
  {
    id: "link",
    phase: "3. 発信",
    title: "計測リンクを作る",
    body: "ASPのリンクを直接貼らず、このアプリの計測リンク（/go/コード）を経由させると、どの媒体・どの投稿からクリックされたかが分かります。",
    href: "/links",
    auto: () => has("SELECT COUNT(*) n FROM links"),
  },
  {
    id: "first-post",
    phase: "3. 発信",
    title: "最初の投稿を作って公開する",
    body: "AI投稿生成で台本・キャプションを作り、公開したら「投稿済み」に。完璧を目指さず、まず出すことが最優先です。",
    href: "/content",
    auto: () => has("SELECT COUNT(*) n FROM posts WHERE status = 'posted'"),
  },
  {
    id: "ten-posts",
    phase: "3. 発信",
    title: "同じ案件で切り口を変えて10投稿する",
    body: "レビュー・比較・ハウツー・ストーリーなど型を変えて当たりを探します。1投稿の当たり外れで判断しないこと。",
    href: "/content",
    auto: async () => ((await get<{ n: number }>("SELECT COUNT(*) n FROM posts WHERE status = 'posted'"))?.n ?? 0) >= 10,
  },
  {
    id: "first-click",
    phase: "4. 計測と改善",
    title: "初クリックを獲得する",
    body: "クリックが来ない＝投稿が見られていないか、リンクへの導線が弱い。プロフィールのリンク・固定投稿・「詳しくはプロフへ」の一言を見直しましょう。",
    href: "/",
    auto: () => has("SELECT COUNT(*) n FROM clicks"),
  },
  {
    id: "first-cv",
    phase: "4. 計測と改善",
    title: "初成果を記録する",
    body: "ASPの管理画面で成果が出たら「成果」から登録（CSV貼り付けも可）。クリックと成果がつながると、案件ごとの実績EPCが出せます。",
    href: "/conversions",
    auto: () => has("SELECT COUNT(*) n FROM conversions"),
  },
  {
    id: "review",
    phase: "4. 計測と改善",
    title: "週1回ダッシュボードで振り返る",
    body: "「クリックは多いのに成果ゼロ」→ 案件と読者がズレている。「クリックが少ない」→ 投稿の見せ方の問題。実績EPCが低い案件は停止し、高い案件に投稿を集中させます。",
    href: "/",
  },
  {
    id: "scale",
    phase: "5. 伸ばす",
    title: "勝ち案件の特単（特別単価）を交渉する",
    body: "安定して成果が出たらASPの担当者に特別単価を相談できます。月5〜10件の成果が目安。報酬が1.2〜2倍になることも。",
  },
  {
    id: "multi",
    phase: "5. 伸ばす",
    title: "勝ちパターンを別媒体に横展開する",
    body: "TikTokで当たった台本をInstagramリール・YouTubeショートへ。ブログやLINEで「保存版のまとめ」を作ると、SNSが伸びない日も成果が積み上がります。",
  },
];

export async function guideState() {
  const manual = new Set(
    (await all<{ step_id: string }>("SELECT step_id FROM guide_progress")).map((r) => r.step_id),
  );
  return Promise.all(
    GUIDE.map(async (s) => {
      const auto = s.auto ? await s.auto() : false;
      return { ...s, done: auto || manual.has(s.id), auto: Boolean(s.auto), autoDone: auto };
    }),
  );
}
