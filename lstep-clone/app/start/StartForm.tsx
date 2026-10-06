"use client";

import { useActionState } from "react";
import { claimWorkspaceAction } from "@/lib/actions";

export default function StartForm() {
  const [error, action, pending] = useActionState(claimWorkspaceAction, null);
  return (
    <form action={action} className="stack" style={{ gap: 12 }}>
      <label className="stack" style={{ gap: 4 }}>
        <span>Channel ID</span>
        <input name="channelId" inputMode="numeric" autoComplete="off" placeholder="例：2001234567" required />
      </label>
      <label className="stack" style={{ gap: 4 }}>
        <span>Channel secret</span>
        <input name="channelSecret" type="password" autoComplete="off" placeholder="32文字の英数字" required />
      </label>
      {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
      <button disabled={pending} style={{ padding: 14 }}>
        {pending ? "確認しています…" : "つないで始める"}
      </button>
    </form>
  );
}
