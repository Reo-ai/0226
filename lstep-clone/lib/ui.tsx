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
    <div className="hint">
      「---」だけの行で吹き出しを分割（最大5つ・何個でも1通扱い）／「image:https://〜」で画像／変数 {"{{name}}"}{" "}
      {"{{link:コード}}"} {"{{form:ID}}"}
    </div>
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
