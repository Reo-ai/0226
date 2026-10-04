import ContentTools from "@/app/(admin)/ContentTools";
import type { Tag } from "./types";

export function TagChip({ tag }: { tag: Tag }) {
  return (
    <span className="tag" style={{ background: tag.color }}>
      {tag.name}
    </span>
  );
}

export function TagSelect({ tags, name, empty = "なし", defaultValue }: { tags: Tag[]; name: string; empty?: string; defaultValue?: number | null }) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""}>
      <option value="">{empty}</option>
      {tags.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

export function ErrorBox({ error }: { error?: string }) {
  if (!error) return null;
  return <div className="panel error">{error}</div>;
}

export function ContentHelp() {
  return (
    <>
      <ContentTools />
      <details>
        <summary className="hint" style={{ cursor: "pointer" }}>書き方</summary>
        <ul className="hint" style={{ lineHeight: 1.8, margin: "4px 0 0", paddingLeft: 18 }}>
          <li>「---」だけの行で吹き出しを分ける（最大5つ・何個でも1通）</li>
          <li>「🖼 画像を入れる」で写真を選ぶと画像の吹き出しになる</li>
          <li>{"{{name}}"} 名前／{"{{link:コード}}"} 計測リンク／{"{{form:番号}}"} フォーム／{"{{booking}}"} 予約ページ／{"{{field:項目名}}"} 友だち情報欄</li>
          <li>「選択肢: A / B / C」の行 → タップできるボタン</li>
          <li>「カード: タイトル」で始める → 画像とボタン付きのカード（「画像: URL」「ボタン: 表示=送る文字 / 表示=https://〜」）</li>
        </ul>
      </details>
    </>
  );
}

export const SOURCE_LABEL: Record<string, string> = {
  user: "受信",
  manual: "個別",
  broadcast: "一斉",
  step: "ステップ",
  auto: "自動応答",
  ai: "AI",
  form: "フォーム案内",
};

export const CHANNEL_LABEL: Record<string, string> = {
  reply: "無料",
  push: "1通消費",
  none: "",
};
