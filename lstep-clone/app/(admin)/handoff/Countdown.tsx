"use client";

import { useEffect, useState } from "react";

/** 残り時間。切れたら新しい番号を出す */
export default function Countdown({ until }: { until: number }) {
  const [left, setLeft] = useState(() => Math.max(0, until - Date.now()));
  useEffect(() => {
    const t = setInterval(() => {
      const l = Math.max(0, until - Date.now());
      setLeft(l);
      if (l === 0) window.location.reload();
    }, 1000);
    return () => clearInterval(t);
  }, [until]);
  const s = Math.ceil(left / 1000);
  return (
    <div className="hint">
      あと {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}（1回だけ使えます）
    </div>
  );
}
