import { createBroadcast } from "@/lib/actions";
import { db } from "@/lib/db";
import type { Link, Tag } from "@/lib/types";

export default function NewBroadcastPage() {
  const tags = db().prepare("SELECT * FROM tags ORDER BY name").all() as Tag[];
  const links = db().prepare("SELECT * FROM links ORDER BY created_at DESC").all() as Link[];
  return (
    <>
      <h1>新規一斉配信</h1>
      <form action={createBroadcast} className="panel stack">
        <input name="title" placeholder="管理用タイトル" />
        <textarea name="content" required style={{ minHeight: 160 }} placeholder={"{{name}}さん、こんにちは！\n詳細はこちら → {{link:CODE}}"} />
        <div className="hint">
          変数: {"{{name}}"}（表示名）
          {links.length > 0 && <> / 計測リンク: {links.map((l) => `{{link:${l.code}}}`).join(" ")}</>}
        </div>
        <fieldset className="row" style={{ border: "1px solid var(--border)", borderRadius: 6 }}>
          <legend>対象タグ（未選択なら全員・複数はいずれかを持つ人）</legend>
          {tags.map((t) => (
            <label key={t.id} className="row">
              <input type="checkbox" name="tagIds" value={t.id} /> {t.name}
            </label>
          ))}
          {tags.length === 0 && <span className="muted">タグがありません</span>}
        </fieldset>
        <div className="row">
          <label className="row"><input type="radio" name="mode" value="now" defaultChecked /> 今すぐ送信</label>
          <label className="row"><input type="radio" name="mode" value="schedule" /> 予約</label>
          <input type="datetime-local" name="scheduledAt" />
          <span className="hint">（日本時間）</span>
        </div>
        <div><button>配信する</button></div>
      </form>
    </>
  );
}
