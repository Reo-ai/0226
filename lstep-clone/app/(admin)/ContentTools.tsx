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

  const last = msgs?.[msgs.length - 1];
  return (
    <div ref={ref} className="pv">
      <div className="row">
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
