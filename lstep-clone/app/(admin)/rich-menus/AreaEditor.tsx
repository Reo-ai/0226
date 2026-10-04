"use client";

import { useEffect, useRef, useState } from "react";

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
  const [labels, setLabels] = useState<Record<number, string>>({});
  const [theme, setTheme] = useState(THEMES[0].key);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [generated, setGenerated] = useState("");
  const l = layouts.find((x) => x.key === key)!;
  const cells = Array.from({ length: l.cols * l.rows }, (_, i) => i);

  // ボタンの文字と色から、メニュー画像（2500×1686 / 843）をその場で描く
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const W = 2500;
    const H = l.size === "full" ? 1686 : 843;
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    const th = THEMES.find((t) => t.key === theme)!;
    const cw = W / l.cols;
    const ch = H / l.rows;
    cells.forEach((i) => {
      const x = (i % l.cols) * cw;
      const y = Math.floor(i / l.cols) * ch;
      ctx.fillStyle = (Math.floor(i / l.cols) + (i % l.cols)) % 2 === 0 ? th.bg : th.bg2;
      ctx.fillRect(x, y, cw, ch);
      const text = (labels[i] ?? "").trim();
      if (!text) return;
      // 先頭が絵文字なら大きく上に、残りを下に
      const m = text.match(/^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*(.*)$/u);
      const emoji = m ? m[1] : "";
      const label = m ? m[2] : text;
      ctx.fillStyle = th.fg;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const base = Math.min(cw, ch);
      let size = base * 0.16;
      ctx.font = `bold ${size}px "Hiragino Sans", "Noto Sans JP", sans-serif`;
      while (size > 20 && ctx.measureText(label).width > cw * 0.86) {
        size -= 4;
        ctx.font = `bold ${size}px "Hiragino Sans", "Noto Sans JP", sans-serif`;
      }
      if (emoji) {
        ctx.font = `${base * 0.3}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        ctx.fillText(emoji, x + cw / 2, y + ch * (label ? 0.4 : 0.5));
        ctx.font = `bold ${size}px "Hiragino Sans", "Noto Sans JP", sans-serif`;
      }
      if (label) ctx.fillText(label, x + cw / 2, y + ch * (emoji ? 0.72 : 0.5));
    });
    // 区切り線
    ctx.strokeStyle = th.line;
    ctx.lineWidth = 6;
    for (let k = 1; k < l.cols; k++) {
      ctx.beginPath();
      ctx.moveTo(k * cw, 0);
      ctx.lineTo(k * cw, H);
      ctx.stroke();
    }
    for (let k = 1; k < l.rows; k++) {
      ctx.beginPath();
      ctx.moveTo(0, k * ch);
      ctx.lineTo(W, k * ch);
      ctx.stroke();
    }
    const any = cells.some((i) => (labels[i] ?? "").trim());
    setGenerated(any ? c.toDataURL("image/jpeg", 0.9) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, theme, labels]);
  return (
    <div className="stack">
      <label className="row">
        レイアウト
        <select name="layout" value={key} onChange={(e) => setKey(e.target.value)}>
          {layouts.map((x) => (
            <option key={x.key} value={x.key}>{x.label}</option>
          ))}
        </select>
      </label>
      <label className="row">
        色
        <select value={theme} onChange={(e) => setTheme(e.target.value)}>
          {THEMES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <div className="menu-grid" style={{ gridTemplateColumns: `repeat(${l.cols}, 1fr)` }}>
        {cells.map((i) => {
          const t = types[i] ?? "message";
          return (
            <div key={`${key}-${i}`}>
              <b>{String.fromCharCode(65 + i)}</b>
              <input
                name={`area${i}_label`}
                placeholder="ボタンの文字（例：🎁 特典）"
                maxLength={16}
                value={labels[i] ?? ""}
                onChange={(e) => setLabels({ ...labels, [i]: e.target.value })}
              />
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
                <input
                  name={`area${i}_value`}
                  placeholder={t === "uri" ? "https://..." : "送る文字（空ならボタンの文字）"}
                  required={t === "uri" || !(labels[i] ?? "").trim()}
                />
              )}
            </div>
          );
        })}
      </div>
      <input type="hidden" name="generatedImage" value={generated} />
      <canvas ref={canvasRef} style={{ width: "100%", maxWidth: 520, borderRadius: 8, border: "1px solid var(--border)" }} />
      <p className="hint" style={{ margin: 0 }}>
        ボタンの文字を入れると、上の画像がそのままメニューになります（自分で作った画像を使うときは下で選んでください）
      </p>
    </div>
  );
}

const THEMES = [
  { key: "green", label: "グリーン", bg: "#06c755", bg2: "#05b44c", fg: "#ffffff", line: "rgba(255,255,255,0.5)" },
  { key: "blue", label: "ブルー", bg: "#1e6fd9", bg2: "#1a62c2", fg: "#ffffff", line: "rgba(255,255,255,0.5)" },
  { key: "dark", label: "ダーク", bg: "#1f2937", bg2: "#273445", fg: "#ffffff", line: "rgba(255,255,255,0.25)" },
  { key: "orange", label: "オレンジ", bg: "#f97316", bg2: "#ea6a0f", fg: "#ffffff", line: "rgba(255,255,255,0.5)" },
  { key: "white", label: "ホワイト", bg: "#ffffff", bg2: "#f3f4f6", fg: "#111827", line: "#d1d5db" },
];
