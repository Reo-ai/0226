import { z } from "zod";
import { dataBlock, runAI } from "./ai";
import { CONTENT_TYPES, type ContentType, platformLabel } from "./constants";
import type { ContentInputs } from "./schemas";

export const generatedSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(20000),
  cta: z.string().max(500),
  factCheckItems: z.array(z.string().max(200)).max(10),
});
export type Generated = z.infer<typeof generatedSchema>;

/** 媒体・種類ごとの書き方 */
const FORMAT: Record<ContentType, string> = {
  blog_outline: "ブログ記事の構成案。タイトル案3つ、狙うキーワード、読者の検索意図、H2/H3の見出し構成（各見出しで書く要点）、まとめとCTAの位置。",
  blog_draft: "ブログ記事の下書き。導入（読者の悩みへの共感）→ 結論 → 本文（見出しごと）→ まとめ → CTA。見出しは「## 」で始める。",
  comparison_outline: "比較記事の構成案。比較する観点（料金・特徴・向いている人など）の表の項目、各商品の紹介の順番、選び方、まとめ。比較対象の具体的な数値は資料にあるものだけを使う。",
  instagram_post: "Instagramのフィード/カルーセル投稿。1枚目のタイトル、2〜7枚目のスライド文言、キャプション、ハッシュタグ5〜10個。",
  instagram_reel: "Instagramリール台本。冒頭2秒のフック、15〜45秒の台本（シーンごとに映像・テロップ・ナレーション）、キャプション、ハッシュタグ。",
  x_post: "X（旧Twitter）の投稿。メイン投稿（全角140字以内）と、スレッドの続き2〜4投稿。",
  tiktok_script: "TikTok動画台本。冒頭2秒のフック（テロップ文）、15〜40秒の台本（シーンごとに映像・テロップ・ナレーション）、キャプション、ハッシュタグ。",
  youtube_script: "YouTube動画台本。タイトル案、冒頭30秒のつかみ、本編の章立てと話す内容、エンディングのCTA。",
  youtube_description: "YouTube概要欄。動画の要約、目次（タイムスタンプは【00:00】のように仮置き）、関連リンクの置き場所、PR表記。",
  cta: "CTA（行動を促す一文）の案を5つ。短く、誇張せず、リンク先で何が得られるかが分かるように。",
};

const DEFAULT_LENGTH: Record<ContentType, number> = {
  blog_outline: 1200, blog_draft: 3000, comparison_outline: 1500, instagram_post: 800, instagram_reel: 600,
  x_post: 500, tiktok_script: 600, youtube_script: 2000, youtube_description: 800, cta: 400,
};

export function platformOf(type: ContentType): string {
  return CONTENT_TYPES.find((c) => c.id === type)?.platform ?? "";
}

/** 広告表示（PR表記）が入っているか */
export function hasAdDisclosure(text: string): boolean {
  return /(^|[\s【［\[（(#＃])(PR|ＰＲ|広告|プロモーション|アフィリエイト広告)/m.test(text) || /#PR\b|#広告/.test(text);
}

const RISKY: [RegExp, string][] = [
  [/必ず(儲|稼|痩|治|効)|絶対(に)?(儲|稼|痩|治|効)/, "「必ず」「絶対」など結果を断定する表現"],
  [/(治る|治ります|完治|病気が良くなる)/, "病気が治るという表現（薬機法）"],
  [/(痩せ(る|ます)|脂肪(が|を)燃焼|若返)/, "痩せる・若返るなど身体への効果の断定（薬機法の可能性）"],
  [/(No\.?\s?1|ナンバーワン|業界初|日本一|最安|最高品質)/i, "No.1・最安・業界初など根拠が必要な表現"],
  [/(元本保証|損しない|ノーリスク|確実に儲)/, "損をしない・確実に儲かるなど金融の誇大表現"],
  [/(誰でも簡単に月\d+万|放置で稼)/, "誰でも簡単に稼げる等の誇大表現"],
  [/(私も使って|実際に使って|愛用して|使ってみた)/, "体験談の表現（実際に使った場合のみ。使っていなければ削除）"],
];

/** 公開前チェック：広告表示の有無と、注意が必要な表現を洗い出す */
export function lintContent(text: string): { adDisclosure: boolean; issues: string[] } {
  const issues = RISKY.filter(([re]) => re.test(text)).map(([, msg]) => msg);
  return { adDisclosure: hasAdDisclosure(text), issues };
}

/** AIなしで使える穴埋めテンプレート。事実は書かず、【】の中をユーザーが埋める */
export function templateFor(type: ContentType, i: ContentInputs): Generated {
  const product = i.product || "【商品・サービス名】";
  const target = i.target || "【ターゲット（誰の・どんな悩み）】";
  const appeal = i.appeal || "【訴求ポイント（資料で確認できる特徴）】";
  const kw = i.keywords || "【キーワード】";
  const cta = `${product}の詳細は${platformOf(type) === "blog" ? "こちらのリンク" : "プロフィールのリンク"}から確認できます。`;
  const facts = [
    `${product}の価格・内容が公式情報と一致しているか`,
    "成果条件・キャンペーンの期間が最新か（ASPで確認）",
    "使っていない場合、体験談の表現が入っていないか",
    "効果の断定・No.1などの根拠が必要な表現がないか",
  ];
  const head = "【PR】この投稿にはアフィリエイト広告を含みます。\n\n";
  const bodies: Record<ContentType, string> = {
    blog_outline: `${head}# タイトル案\n1. ${target}向け｜${product}の特徴と選び方\n2. ${kw}で迷ったら読む記事\n3. 【自分で考えたタイトル】\n\n# 狙うキーワード\n${kw}\n\n# 読者の検索意図\n- 【何を知りたくて検索したか】\n\n# 見出し構成\n## ${target}が抱えている悩み\n## ${product}とは（公式情報で確認した内容だけ）\n## ${appeal}\n## ${product}が向いている人・向いていない人\n## よくある質問\n## まとめ（CTA）`,
    blog_draft: `${head}## はじめに\n${target}のあなたへ。【読者の悩みに共感する一文】\n\n## 結論\n【この記事の結論を1〜2文で】\n\n## ${product}の特徴\n${appeal}\n（公式サイト・資料で確認した内容だけを書きます）\n\n## 向いている人・向いていない人\n- 向いている人：【】\n- 向いていない人：【】\n\n## まとめ\n【要点を3つ】\n\n${cta}`,
    comparison_outline: `${head}# 比較の観点\n| 観点 | ${product} | 【比較対象】 |\n|---|---|---|\n| 料金 | 【公式で確認】 | 【公式で確認】 |\n| 特徴 | ${appeal} | 【】 |\n| 向いている人 | 【】 | 【】 |\n\n# 構成\n## 選び方のポイント\n## 比較表\n## ${product}が向いている人\n## まとめ（CTA）`,
    instagram_post: `${head}1枚目：${target}へ｜【キャッチコピー】\n2枚目：こんな悩みありませんか？【】\n3枚目：解決のヒント【】\n4枚目：${product}の特徴｜${appeal}\n5枚目：向いている人【】\n6枚目：注意点【】\n7枚目：保存して見返してね\n\nキャプション：\n【投稿の要点を3行で】\n${cta}\n\n#PR #【ジャンル】 #【キーワード】`,
    instagram_reel: `${head}【冒頭2秒のフック】${target}、【悩み】で困ってない？\n\n0-3秒｜映像：【】／テロップ：【フック】\n3-15秒｜ナレーション：【悩みの共感】\n15-30秒｜ナレーション：【解決のヒント】／${product}：${appeal}\n30-40秒｜テロップ：詳しくはプロフィールのリンクへ\n\nキャプション：【要点】 ${cta}\n#PR #【ジャンル】`,
    x_post: `${head}【1投稿目】${target}へ。【気づき・結論】（140字以内）\n\n【2投稿目】理由は【】\n\n【3投稿目】${product}は${appeal}。【向いている人】\n\n【4投稿目】${cta} #PR`,
    tiktok_script: `${head}【冒頭2秒のフック】「${target}、それ損してるかも」\n\n0-2秒｜テロップ：【フック】\n2-10秒｜ナレーション：【悩みの共感】\n10-25秒｜ナレーション：【解決のヒント】／${product}の${appeal}\n25-30秒｜テロップ：詳しくはプロフィールから\n\nキャプション：【要点】 #PR #【ジャンル】`,
    youtube_script: `${head}タイトル案：${target}向け｜${product}を選ぶ前に知っておきたいこと\n\n【0:00 つかみ】この動画では【】が分かります\n【章1】${target}がつまずくポイント\n【章2】${product}の特徴：${appeal}\n【章3】向いている人・向いていない人\n【まとめ】${cta}`,
    youtube_description: `${head}この動画では、${target}に向けて${product}の特徴を解説しています。\n\n▼目次\n【00:00】はじめに\n【00:00】${product}の特徴\n【00:00】まとめ\n\n▼紹介した商品\n${product}：【計測リンク】\n※リンクはアフィリエイト広告です。`,
    cta: `${head}1. ${product}の詳細はプロフィールのリンクからどうぞ\n2. ${target}の方は、まず公式サイトで内容を確認してみてください\n3. 気になった方は、リンク先で料金と条件をチェック\n4. 保存しておくと、あとで見返せます\n5. 【自分の言葉で書いたCTA】`,
  };
  const label = CONTENT_TYPES.find((c) => c.id === type)?.label ?? type;
  return { title: `${label}：${product}`, body: bodies[type], cta, factCheckItems: facts };
}

/** コンテンツAI：下書きを生成。AIなしならテンプレート */
export async function generateContent(type: ContentType, i: ContentInputs, offer: { name: string; conversionConditions: string; notes: string } | null, linkUrl: string | null) {
  const length = i.length ?? DEFAULT_LENGTH[type];
  return runAI({
    system: `あなたはアフィリエイト向けのコンテンツを書くAIです。読者の悩みに寄り添い、誇張せず、根拠のある情報だけで商品を紹介します。
- 本文の冒頭に「【PR】」または「広告」の表記を必ず入れる
- 根拠資料にない事実（価格・効果・実績・ランキング）を書かない。必要なら【要確認】と書く
- 架空の体験談・レビューを作らない。体験の部分は「【ここにあなたの実体験】」のように空欄にする
- factCheckItems に、公開前にユーザーが確認すべき事実を具体的に挙げる`,
    prompt: [
      `作るもの：${platformLabel(platformOf(type)) === "未指定" ? "" : platformLabel(platformOf(type)) + "の"}${CONTENT_TYPES.find((c) => c.id === type)?.label}`,
      `書き方：${FORMAT[type]}`,
      `本文の目安：${length}文字程度`,
      dataBlock("入力", i),
      offer ? dataBlock("案件（ASPで確認済みの情報）", offer) : "",
      linkUrl ? `紹介リンク（本文やCTAで使う）：${linkUrl}` : "",
    ].filter(Boolean).join("\n\n"),
    schema: generatedSchema,
    maxTokens: Math.min(8000, Math.round(length * 2.5) + 800),
    fallback: () => templateFor(type, i),
  });
}

/** Markdown 書き出し */
export function toMarkdown(d: { title: string; body: string; cta: string; platform: string; contentType: string }, checks: { item: string; checked: boolean }[]): string {
  return [
    `# ${d.title}`,
    "",
    `- 媒体: ${platformLabel(d.platform)}`,
    `- 種類: ${CONTENT_TYPES.find((c) => c.id === d.contentType)?.label ?? d.contentType}`,
    "",
    d.body,
    "",
    d.cta ? `## CTA\n\n${d.cta}\n` : "",
    checks.length ? `## ファクトチェック\n\n${checks.map((c) => `- [${c.checked ? "x" : " "}] ${c.item}`).join("\n")}\n` : "",
  ].join("\n");
}
