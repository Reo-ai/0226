"use client";

import { useRef, useState } from "react";

type Action = { type: string; label?: string; text?: string; uri?: string };
type Comp = { type: string; text?: string; url?: string; contents?: Comp[]; action?: Action; style?: string };
type Bubble = { type: "bubble"; hero?: Comp; body?: Comp; footer?: Comp };
type Msg = {
  type: "text" | "image" | "flex";
  text?: string;
  originalContentUrl?: string;
  altText?: string;
  contents?: Bubble | { type: "carousel"; contents: Bubble[] };
  quickReply?: { items: { action: Action }[] };
};

function Card({ b }: { b: Bubble }) {
  const texts = b.body?.contents ?? [];
  const buttons = b.footer?.contents ?? [];
  return (
    <div className="pv-card">
      {b.hero?.url && <img src={b.hero.url} alt="" />}
      <div className="pv-card-body">
        {texts.map((t, i) => (
          <div key={i} className={i === 0 ? "pv-title" : "pv-text"}>
            {t.text}
          </div>
        ))}
      </div>
      {buttons.map((btn, i) => (
        <div key={i} className={i === 0 ? "pv-btn primary" : "pv-btn"}>
          {btn.action?.label}
          {btn.action?.type === "uri" ? " ↗" : ""}
        </div>
      ))}
    </div>
  );
}

/** 本文の入力欄の下に置く「プレビュー」「自分にテスト送信」 */
export default function ContentTools() {
  const ref = useRef<HTMLDivElement>(null);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(test: boolean) {
    const area = ref.current?.closest("form")?.querySelector<HTMLTextAreaElement>("textarea[name=content], textarea[name=reply]");
    const content = area?.value ?? "";
    if (!content.trim()) return setNote({ ok: false, text: "本文を入力してください" });
    if (test && !confirm("管理者の LINE にテスト送信します（1通分の配信数を使います）。よろしいですか？")) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ content, test }) });
      const j = (await res.json()) as { messages?: Msg[]; error?: string; sent?: string[] };
      if (j.messages) setMsgs(j.messages);
      if (j.error) setNote({ ok: false, text: j.error });
      else setNote({ ok: true, text: test ? `✓ ${j.sent?.join("・")} の LINE に送りました` : "✓ LINE に送れる形式です" });
    } finally {
      setBusy(false);
    }
  }

  /** 写真を選ぶ → 長い辺1600pxまで縮めて JPEG にし、アップロードして本文に「image:URL」を入れる */
  async function upload(file: File) {
    const area = ref.current?.closest("form")?.querySelector<HTMLTextAreaElement>("textarea[name=content], textarea[name=reply]");
    if (!area) return;
    setBusy(true);
    setNote(null);
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      let dataUrl = "";
      for (const q of [0.85, 0.7, 0.55, 0.4]) {
        dataUrl = canvas.toDataURL("image/jpeg", q);
        if (dataUrl.length * 0.75 < 950_000) break;
      }
      const res = await fetch("/api/upload", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dataUrl }) });
      const j = (await res.json()) as { url?: string; error?: string };
      if (!j.url) return setNote({ ok: false, text: j.error ?? "アップロードできませんでした" });
      const block = `image:${j.url}`;
      area.value = area.value.trim() ? `${area.value.trimEnd()}\n---\n${block}` : block;
      area.dispatchEvent(new Event("input", { bubbles: true }));
      setNote({ ok: true, text: "✓ 画像を入れました" });
    } catch {
      setNote({ ok: false, text: "この画像は読み込めませんでした（JPEG・PNG・HEIC 以外は不可）" });
    } finally {
      setBusy(false);
    }
  }

  const last = msgs?.[msgs.length - 1];
  return (
    <div ref={ref} className="pv">
      <div className="row">
        <label className={`btn ghost small${busy ? " disabled" : ""}`} style={{ cursor: "pointer" }}>
          🖼 画像を入れる
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void upload(f);
            }}
          />
        </label>
        <button type="button" className="ghost small" disabled={busy} onClick={() => run(false)}>
          プレビュー
        </button>
        <button type="button" className="ghost small" disabled={busy} onClick={() => run(true)}>
          自分にテスト送信
        </button>
        {note && <span style={{ color: note.ok ? "var(--accent)" : "var(--danger)", fontSize: 12 }}>{note.text}</span>}
      </div>
      {msgs && (
        <div className="pv-chat">
          {msgs.map((m, i) => (
            <div key={i}>
              {m.type === "text" && <div className="pv-bubble">{m.text}</div>}
              {m.type === "image" && <img className="pv-img" src={m.originalContentUrl} alt="" />}
              {m.type === "flex" && m.contents && (
                <div className="pv-carousel">
                  {m.contents.type === "carousel" ? m.contents.contents.map((b, j) => <Card key={j} b={b} />) : <Card b={m.contents} />}
                </div>
              )}
            </div>
          ))}
          {last?.quickReply && (
            <div className="pv-chips">
              {last.quickReply.items.map((it, i) => (
                <span key={i}>{it.action.label}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
