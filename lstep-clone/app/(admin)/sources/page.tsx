import QRCode from "qrcode";
import { createSource, deleteSource } from "@/lib/actions";
import { all } from "@/lib/db";
import type { Source, Tag } from "@/lib/types";
import { TagSelect } from "@/lib/ui";

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
  const base = process.env.BASE_URL || "http://localhost:3000";
  const liff = Boolean(process.env.LIFF_ID && process.env.LINE_LOGIN_CHANNEL_ID);
  // LIFF設定時は LIFF URL（LINEアプリ内で開き、ユーザーを特定できる）
  const urlOf = (code: string) => (liff ? `https://liff.line.me/${process.env.LIFF_ID}/${code}` : `${base}/join/${code}`);
  const qrs = await Promise.all(sources.map((s) => QRCode.toDataURL(urlOf(s.code), { margin: 1, width: 160 })));
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
    </>
  );
}
