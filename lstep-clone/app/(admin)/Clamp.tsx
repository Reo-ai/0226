"use client";

import { useState } from "react";

/** 長い本文は最初の数行だけ見せ、押すと全文を開く（一覧が縦に長くなりすぎないように） */
export default function Clamp({ text, lines = 4 }: { text: string; lines?: number }) {
  const [open, setOpen] = useState(false);
  const long = text.split("\n").length > lines || text.length > lines * 40;
  return (
    <div>
      <div className="pre" style={open || !long ? undefined : { display: "-webkit-box", WebkitLineClamp: lines, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
        {text}
      </div>
      {long && (
        <button type="button" className="ghost small" style={{ marginTop: 6 }} onClick={() => setOpen((v) => !v)}>
          {open ? "たたむ" : "全文を見る"}
        </button>
      )}
    </div>
  );
}
