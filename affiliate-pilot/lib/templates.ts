import { z } from "zod";

export const templateSchema = z.object({ id: z.string(), name: z.string().min(1).max(60), body: z.string().min(1).max(4000) });
export const templatesSchema = z.array(templateSchema);
export type Template = z.infer<typeof templateSchema>;

export const DEFAULT_TEMPLATES: Template[] = [
  { id: "pr-top", name: "PR表記（冒頭）", body: "【PR】この投稿にはアフィリエイト広告を含みます。" },
  { id: "pr-blog", name: "PR表記（ブログ記事の冒頭）", body: "※本記事にはアフィリエイト広告（PR）が含まれています。紹介する商品・サービスは、公式情報をもとに選んでいます。" },
  { id: "profile", name: "プロフィール文の型", body: "【誰に】向けに【何を】発信｜【自分の実績・立場（事実のみ）】\n▼【リンク先で得られるもの】はこちら" },
  { id: "cta-sns", name: "CTA（SNS）", body: "詳しくはプロフィールのリンクからチェックしてみてください。保存しておくと、あとで見返せます。" },
  { id: "cta-blog", name: "CTA（ブログ）", body: "料金や条件は変わることがあるため、最新の情報は公式サイトで確認してください。▶【商品名】の公式サイトを見る" },
  { id: "disclaimer", name: "効果に関する注意書き", body: "※感じ方には個人差があります。効果・効能を保証するものではありません。" },
];

/** 投稿前チェックリスト（すべての媒体共通） */
export const POST_CHECKLIST = [
  "冒頭または目立つ位置に「PR」「広告」の表記がある",
  "価格・内容・キャンペーン期間をASP・公式サイトで確認した",
  "使っていない商品の体験談を書いていない",
  "「必ず」「絶対」「No.1」「最安」など根拠のない表現がない",
  "健康食品・化粧品で効能を断定していない（薬機法）",
  "リンク先が正しく開く（計測リンクを自分でクリックして確認）",
  "画像・音楽・引用の権利に問題がない",
  "公開後、URLをコンテンツ工房に記録する",
];
