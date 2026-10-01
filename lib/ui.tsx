import type { Tag } from "./types";

export function TagChip({ tag }: { tag: Tag }) {
  return (
    <span className="tag" style={{ background: tag.color }}>
      {tag.name}
    </span>
  );
}

export function TagSelect({ tags, name, empty = "なし" }: { tags: Tag[]; name: string; empty?: string }) {
  return (
    <select name={name} defaultValue="">
      <option value="">{empty}</option>
      {tags.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

export const SOURCE_LABEL: Record<string, string> = {
  user: "受信",
  manual: "個別",
  broadcast: "一斉",
  step: "ステップ",
  auto: "自動応答",
  ai: "AI",
};
