import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { approveRequest, consumeRequest, findRequest, finishLogin } from "@/lib/loginFlow";

export const dynamic = "force-dynamic";

const CALLBACK_COOKIE = "login_cb";

async function myRequest() {
  const rid = (await cookies()).get(CALLBACK_COOKIE)?.value;
  const r = await findRequest(rid);
  return r && !r.used && r.line_user_id ? r : undefined;
}

/** 番号が同じ → 始めた画面（ホーム画面のアプリ）でログインを完了させる */
async function approve() {
  "use server";
  const r = await myRequest();
  if (!r) redirect("/login?line=failed");
  await approveRequest(r.rid);
  redirect("/login/confirm?done=1");
}

/** このブラウザでそのまま使う */
async function useHere() {
  "use server";
  const r = await myRequest();
  if (!r || !(await consumeRequest(r.rid))) redirect("/login?line=failed");
  (await cookies()).delete(CALLBACK_COOKIE);
  redirect(await finishLogin(r.line_user_id!, r.display_name ?? ""));
}

// LINEから、ログインを始めたのとは別のブラウザに戻ってきたときの確認画面
export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const { done } = await searchParams;
  const r = await myRequest();
  return (
    <div style={{ maxWidth: 400, margin: "10vh auto", padding: 16 }}>
      <div className="panel stack" style={{ gap: 16, textAlign: "center" }}>
        {done ? (
          <>
            <h1 style={{ margin: 0 }}>✅ 確認できました</h1>
            <p style={{ margin: 0 }}>ログインを始めた画面（ホーム画面のアプリなど）に戻ってください。自動でログインされます。</p>
          </>
        ) : r ? (
          <>
            <h1 style={{ margin: 0 }}>ログインの確認</h1>
            <p style={{ margin: 0 }}>ログインを始めた画面に出ている番号と同じですか？</p>
            <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: ".2em" }}>{r.code}</div>
            <form action={approve}>
              <button style={{ width: "100%", padding: 14 }}>同じなので続ける</button>
            </form>
            <form action={useHere}>
              <button className="ghost" style={{ width: "100%" }}>この画面でそのまま使う</button>
            </form>
            <p className="hint" style={{ margin: 0 }}>番号を見ていない・違う場合は、何も押さずに閉じてください。</p>
          </>
        ) : (
          <>
            <h1 style={{ margin: 0 }}>時間切れです</h1>
            <a className="btn" href="/login">もう一度ログインする</a>
          </>
        )}
      </div>
    </div>
  );
}
