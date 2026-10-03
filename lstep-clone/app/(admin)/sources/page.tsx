import { baseUrl } from "@/lib/env";
import QRCode from "qrcode";
import { createSource, deleteSource } from "@/lib/actions";
import { all } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import type { Source, Tag } from "@/lib/types";
import { TagSelect } from "@/lib/ui";
import { currentWorkspace, withWs } from "@/lib/workspace";

export default async function SourcesPage() {
  const sources = await all<Source & { visits: number; friends: number; blocked: number }>(
    `SELECT s.*,
            (SELECT COUNT(*) FROM source_visits v WHERE v.source_id = s.id) visits,
            (SELECT COUNT(*) FROM friends f WHERE f.source_id = s.id) friends,
            (SELECT COUNT(*) FROM friends f WHERE f.source_id = s.id AND f.blocked = 1) blocked
     FROM sources s ORDER BY s.created_at DESC`,
  );
  const tags = await all<Tag>("SELECT * FROM tags ORDER BY name");
  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  const base = baseUrl();
  const liff = Boolean(process.env.LIFF_ID && process.env.LINE_LOGIN_CHANNEL_ID);
  // LIFF設定時は LIFF URL（LINEアプリ内で開き、ユーザーを特定できる）
  const ws = await currentWorkspace();
  const urlOf = (code: string) =>
    withWs(liff ? `https://liff.line.me/${process.env.LIFF_ID}/${code}` : `${base}/join/${code}`, ws);
  const qrs = await Promise.all(sources.map((s) => QRCode.toDataURL(urlOf(s.code), { margin: 1, width: 160 })));
  // 最近の訪問：LINEのだれか分かったか・友だちと結びついたか（うまく計測できているかの確認用）
  const visits = await all<{ id: number; created_at: number; source: string; line_user_id: string | null; attributed: number; friend: string | null }>(
    `SELECT v.id, v.created_at, s.name source, v.line_user_id, v.attributed,
            (SELECT COALESCE(display_name, '（名前なし）') FROM friends f WHERE f.line_user_id = v.line_user_id) friend
     FROM source_visits v JOIN sources s ON s.id = v.source_id ORDER BY v.id DESC LIMIT 10`,
  );
  return (
    <>
      <h1>流入経路分析</h1>
      <p className="muted">
        経路ごとの友だち追加URL/QRを発行し、どこから何人増えたかを計測します。追加時にタグも自動付与できます。
      </p>
      {!liff && (
        <div className="panel error">
          LIFF未設定のため「訪問数」のみ計測されます。誰がどの経路から来たかを計測するには、READMEの手順でLIFFを設定してください（無料）。
        </div>
      )}
      <form action={createSource} className="panel row">
        <input name="name" placeholder="経路名（例: Instagramプロフィール）" required />
        <input name="code" placeholder="コード（任意）" style={{ width: 120 }} />
        追加時タグ: <TagSelect tags={tags} name="addTagId" />
        <button>作成</button>
      </form>
      <div className="panel">
        <table>
          <thead><tr><th>経路</th><th>URL / QR</th><th>付与タグ</th><th>訪問</th><th>友だち</th><th>ブロック</th><th /></tr></thead>
          <tbody>
            {sources.map((s, i) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>
                  <code style={{ wordBreak: "break-all" }}>{urlOf(s.code)}</code>
                  <img src={qrs[i]} alt="" width={96} height={96} style={{ display: "block", marginTop: 4 }} />
                </td>
                <td>{s.add_tag_id ? tagName.get(s.add_tag_id) : "-"}</td>
                <td>{s.visits}</td>
                <td>{s.friends}</td>
                <td>{s.blocked}</td>
                <td>
                  <form action={deleteSource}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className="danger small">削除</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="panel">
        <summary style={{ cursor: "pointer" }}>最近の訪問（計測の確認）</summary>
        <table>
          <tbody>
            {visits.map((v) => (
              <tr key={v.id}>
                <td>{fmtDateTime(v.created_at)}</td>
                <td>{v.source}</td>
                <td>{!v.line_user_id ? "LINEの人が分からない" : v.friend ? `友だち：${v.friend}` : "まだ友だちではない人"}</td>
                <td>{v.attributed ? "✅ 経路を記録" : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
