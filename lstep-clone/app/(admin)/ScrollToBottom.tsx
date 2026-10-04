"use client";

import { useEffect } from "react";

/** トークを開いたら、いちばん新しいメッセージ（下）が見えるようにする */
export default function ScrollToBottom({ id }: { id: string }) {
  useEffect(() => {
    const el = document.getElementById(id);
    if (el) el.scrollTop = el.scrollHeight;
  }, [id]);
  return null;
}
