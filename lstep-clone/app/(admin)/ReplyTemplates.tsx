"use client";

import { useRef } from "react";

/** 返信欄の上に並ぶ定型文。押すと入力欄に入る（入力中の文があれば後ろに足す） */
export default function ReplyTemplates({ templates }: { templates: { id: number; title: string; content: string }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  if (templates.length === 0) return <div ref={ref} />;
  const put = (content: string) => {
    const ta = ref.current?.closest("form")?.querySelector<HTMLTextAreaElement>("textarea[name=content]");
    if (!ta) return;
    ta.value = ta.value.trim() ? `${ta.value.trimEnd()}\n${content}` : content;
    ta.focus();
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  };
  return (
    <div ref={ref} className="row" style={{ gap: 6, flexWrap: "wrap" }}>
      {templates.map((t) => (
        <button key={t.id} type="button" className="ghost small" onClick={() => put(t.content)} title={t.content}>
          {t.title}
        </button>
      ))}
    </div>
  );
}
