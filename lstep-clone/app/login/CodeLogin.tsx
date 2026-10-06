"use client";

import { useActionState } from "react";
import { loginWithHandoffCode } from "@/lib/actions";

/** パソコンの「スマホで開く」に出る6桁の番号でログイン */
export default function CodeLogin() {
  const [error, action, pending] = useActionState(loginWithHandoffCode, null);
  return (
    <details className="more">
      <summary>パソコンに出た番号でログイン</summary>
      <form action={action} className="row" style={{ marginTop: 8 }}>
        <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6桁の番号" style={{ width: 140, letterSpacing: ".15em" }} required />
        <button disabled={pending}>ログイン</button>
      </form>
      {error && <div style={{ color: "var(--danger)", marginTop: 6 }}>{error}</div>}
    </details>
  );
}
