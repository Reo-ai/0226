import Link from "next/link";
import { installTemplateAction } from "@/lib/actions";
import { installedKeys, TEMPLATES } from "@/lib/templates";

export const dynamic = "force-dynamic";

// 導線テンプレート：よくある配信の流れをボタン1つで作る
export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const { done } = await searchParams;
  const installed = await installedKeys();
  const doneTpl = TEMPLATES.find((t) => t.key === done);
  return (
    <>
      <h1>導線テンプレート</h1>
      <p className="muted">
        よくある配信の流れを、ボタン1つで作れます。作ったあとは中身（文章・URL）を自分用に書き換えてください。
        ステップ配信はすぐ動く状態で作られます（同じテンプレートを2回目に作ると「（コピー）」の名前で停止の状態になります）。
        「友だち追加時」に始まる導線を2つ以上入れると、新しい友だちに両方届くので、使わないほうは止めてください。
      </p>
      {doneTpl && (
        <div className="panel" style={{ borderLeft: "4px solid var(--green, #06c755)" }}>
          「{doneTpl.name}」を作りました。<Link href="/scenarios">ステップ配信</Link>・<Link href="/forms">回答フォーム</Link>・
          <Link href="/auto-replies">自動応答</Link>で文章を書き換えてください。
        </div>
      )}
      {TEMPLATES.map((t) => (
        <div key={t.key} className="panel">
          <h2 style={{ marginTop: 0 }}>
            {t.name} {installed.has(t.key) && <span className="badge on">導入済み</span>}
          </h2>
          <p>{t.summary}</p>
          <p className="muted small">作られるもの：{t.makes.join("、")}</p>
          <form action={installTemplateAction}>
            <input type="hidden" name="key" value={t.key} />
            <button>{installed.has(t.key) ? "もう一度作る" : "この導線を作る"}</button>
          </form>
        </div>
      ))}
    </>
  );
}
