import { createLink, deleteLink } from "@/lib/actions";
import { all } from "@/lib/db";
import { baseUrl } from "@/lib/env";
import { PLATFORMS, PLATFORM_LABEL } from "@/lib/score";
import { linkStats } from "@/lib/stats";
import type { Program } from "@/lib/types";
import { ErrorBox, type SP } from "@/lib/ui";

export default async function LinksPage({ searchParams }: { searchParams: SP }) {
  const { error } = await searchParams;
  const links = await linkStats();
  const programs = await all<Program>("SELECT * FROM programs WHERE status != 'paused' ORDER BY name");
  const base = baseUrl();

  return (
    <>
      <h1>計測リンク</h1>
      <ErrorBox error={error} />
      <form action={createLink} className="panel stack">
        <h2>リンクを作成</h2>
        <div className="row">
          <select name="program_id" defaultValue="">
            <option value="">案件を選ぶ（任意）</option>
            {programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input name="name" placeholder="リンク名（例: プロテイン_TikTok固定）" />
          <input name="code" placeholder="コード（空欄で自動）" style={{ width: 160 }} />
          <select name="channel" defaultValue="">
            <option value="">媒体（既定）</option>
            {PLATFORMS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <input name="url" placeholder="リンク先URL（空欄なら案件のアフィリエイトリンク）" />
        <div><button>作成</button></div>
        <p className="hint">
          URLの末尾に <code>?ch=tiktok</code> のように付けると、1つのリンクで媒体別のクリックを分けて計測できます。
        </p>
      </form>

      <div className="panel">
        <table>
          <thead><tr><th>リンク</th><th>計測URL</th><th>案件</th><th>総クリック</th><th /></tr></thead>
          <tbody>
            {links.map((l) => (
              <tr key={l.id}>
                <td>{l.name}<div className="hint">{PLATFORM_LABEL[l.channel] ?? ""}</div></td>
                <td>
                  <code>{`${base}/go/${l.code}`}</code>
                  <details>
                    <summary className="hint">媒体別URL</summary>
                    {PLATFORMS.map(([k, v]) => (
                      <div key={k} className="hint">{v}: <code>{`${base}/go/${l.code}?ch=${k}`}</code></div>
                    ))}
                  </details>
                </td>
                <td>{l.program_name ?? "-"}</td>
                <td>{l.clicks}</td>
                <td>
                  <form action={deleteLink}>
                    <input type="hidden" name="id" value={l.id} />
                    <button className="danger small">削除</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {links.length === 0 && <p className="hint">まだリンクがありません。</p>}
      </div>
    </>
  );
}
