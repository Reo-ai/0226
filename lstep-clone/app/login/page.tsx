"use client";

import { useActionState } from "react";
import { login } from "@/lib/actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <div style={{ maxWidth: 360, margin: "15vh auto", padding: 16 }}>
      <div className="panel stack">
        <h1>LINE配信管理 ログイン</h1>
        <form action={action} className="stack">
          <input type="password" name="password" placeholder="管理パスワード" required autoFocus />
          <button disabled={pending}>ログイン</button>
          {error && <div style={{ color: "var(--danger)" }}>{error}</div>}
        </form>
      </div>
    </div>
  );
}
