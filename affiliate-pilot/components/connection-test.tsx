"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { testConnection } from "@/lib/actions/settings";

const NAME: Record<string, string> = { ollama: "ローカルAI（Ollama）", claude: "Claude", fallback: "AIなし（ルール・テンプレート）" };

export function ConnectionTest() {
  const [state, action] = useActionState(testConnection, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <SubmitButton variant="outline" className="self-start" pendingLabel="確認中…">接続テスト</SubmitButton>
      {state && (
        <ul className="flex flex-col gap-2 text-sm" aria-live="polite">
          {state.results.map((r) => (
            <li key={r.provider} className="rounded-lg border p-3">
              <div className="flex items-center gap-2"><strong>{NAME[r.provider] ?? r.provider}</strong><Badge variant={r.ok ? "success" : "warning"}>{r.ok ? "使用可" : "使用不可"}</Badge></div>
              <p className="mt-1 text-muted-foreground">{r.message}</p>
              {r.models && r.models.length > 0 && <p className="mt-1 text-xs text-muted-foreground">取得済みのモデル：{r.models.join("、")}</p>}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
