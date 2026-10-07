"use client";

import { useActionState, useEffect } from "react";
import { requestJoinAction } from "@/lib/actions";

/** 公式LINEのIDを入れて、管理者の LINE に許可をお願いする。許可されたら自動で開く */
export default function JoinForm() {
  const [state, action, pending] = useActionState(requestJoinAction, null);
  const sent = state === "sent";
  useEffect(() => {
    if (!sent) return;
    const t = setInterval(async () => {
      const j = (await (await fetch("/api/join-request", { cache: "no-store" })).json()) as { state: string };
      if (j.state === "approved") window.location.replace("/dashboard");
      if (j.state === "denied") {
        clearInterval(t);
        alert("管理者に拒否されました");
      }
    }, 2500);
    return () => clearInterval(t);
  }, [sent]);

  if (sent) {
    return (
      <div className="panel" style={{ margin: 0, textAlign: "center" }}>
        <b>管理者の LINE に送りました</b>
        <p className="hint" style={{ margin: "6px 0 0" }}>許可されると、この画面が自動で開きます（30分以内）</p>
      </div>
    );
  }
  return (
    <form action={action} className="stack" style={{ gap: 10 }}>
      <label className="stack" style={{ gap: 4 }}>
        <span>公式LINEのID</span>
        <input name="basicId" placeholder="@701xxsjg" autoCapitalize="none" autoComplete="off" required />
      </label>
      {state && <div style={{ color: "var(--danger)" }}>{state}</div>}
      <button disabled={pending} style={{ padding: 14 }}>
        {pending ? "送っています…" : "管理者に許可をもらう"}
      </button>
    </form>
  );
}
