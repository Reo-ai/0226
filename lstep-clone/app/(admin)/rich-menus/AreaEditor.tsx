"use client";

import { useState } from "react";

interface Opt {
  id: number;
  name: string;
}

export default function AreaEditor({
  layouts,
  tags,
  forms,
}: {
  layouts: { key: string; label: string; cols: number; rows: number; size: string }[];
  tags: Opt[];
  forms: Opt[];
}) {
  const [key, setKey] = useState(layouts[0].key);
  const [types, setTypes] = useState<Record<number, string>>({});
  const l = layouts.find((x) => x.key === key)!;
  const cells = Array.from({ length: l.cols * l.rows }, (_, i) => i);
  return (
    <div className="stack">
      <label className="row">
        レイアウト
        <select name="layout" value={key} onChange={(e) => setKey(e.target.value)}>
          {layouts.map((x) => (
            <option key={x.key} value={x.key}>{x.label}</option>
          ))}
        </select>
        <span className="hint">画像サイズ 2500×{l.size === "full" ? 1686 : 843}px（PNG/JPEG・1MB以下）</span>
      </label>
      <div className="menu-grid" style={{ gridTemplateColumns: `repeat(${l.cols}, 1fr)` }}>
        {cells.map((i) => {
          const t = types[i] ?? "message";
          return (
            <div key={`${key}-${i}`}>
              <b>{String.fromCharCode(65 + i)}</b>
              <select name={`area${i}_type`} value={t} onChange={(e) => setTypes({ ...types, [i]: e.target.value })}>
                <option value="message">テキスト送信</option>
                <option value="uri">URLを開く</option>
                <option value="tag">タグ付与</option>
                <option value="form">フォーム案内</option>
                <option value="none">なし</option>
              </select>
              {t === "tag" ? (
                <select name={`area${i}_value`}>
                  {tags.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              ) : t === "form" ? (
                <select name={`area${i}_value`}>
                  {forms.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              ) : t === "none" ? null : (
                <input name={`area${i}_value`} placeholder={t === "uri" ? "https://..." : "送信する文字（キーワード応答と連動）"} required />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
