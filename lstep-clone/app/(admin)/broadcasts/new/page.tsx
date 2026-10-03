import { createBroadcast } from "@/lib/actions";
import { all, get } from "@/lib/db";
import { pushRemaining } from "@/lib/quota";
import type { Link, Tag } from "@/lib/types";
import { listFields } from "@/lib/fields";
import { emptySegment } from "@/lib/segment";
import { ContentHelp, ErrorBox } from "@/lib/ui";
import SegmentFields from "../../SegmentFields";

export default async function NewBroadcastPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const tags = await all<Tag & { n: number }>(
    `SELECT t.*, (SELECT COUNT(*) FROM friend_tags ft JOIN friends f ON f.id = ft.friend_id
                   WHERE ft.tag_id = t.id AND f.blocked = 0) n FROM tags t ORDER BY name`,
  );
  const links = await all<Link>("SELECT * FROM links ORDER BY created_at DESC");
  const active = (await get<{ n: number }>("SELECT COUNT(*) n FROM friends WHERE blocked = 0"))?.n ?? 0;
  const remaining = await pushRemaining();
  const sources = await all<{ id: number; name: string }>("SELECT id, name FROM sources ORDER BY id");
  const fields = await listFields();
  return (
    <>
      <h1>新規一斉配信</h1>
      <ErrorBox error={error} />
      <form action={createBroadcast} className="panel stack">
        <input name="title" placeholder="管理用タイトル" />
        <textarea
          name="content"
          required
          style={{ minHeight: 180 }}
          placeholder={"{{name}}さん、こんにちは！\n---\nimage:https://example.com/banner.jpg\n---\n詳細はこちら → {{link:CODE}}"}
        />
        <ContentHelp />
        {links.length > 0 && <div className="hint">計測リンク: {links.map((l) => `{{link:${l.code}}}`).join(" ")}</div>}
        <div className="stack" style={{ gap: 4 }}>
          <b>送る相手（何も選ばなければ全員 {active}人）</b>
          <SegmentFields tags={tags} sources={sources} fields={fields} value={emptySegment()} />
        </div>
        <fieldset className="stack">
          <legend>届け方</legend>
          <label className="row">
            <input type="radio" name="delivery" value="reply" defaultChecked />
            <span><b className="free">無料</b>：相手から次にメッセージ・ボタン操作があった時に届ける（14日以内）</span>
          </label>
          <label className="row">
            <input type="radio" name="delivery" value="push" />
            <span>プッシュ：すぐ全員に届ける（対象人数ぶん通数を消費・今月の残り {Number.isFinite(remaining) ? `${remaining}通` : "無制限"}）</span>
          </label>
        </fieldset>
        <div className="row">
          <label className="row"><input type="radio" name="mode" value="now" defaultChecked /> 今すぐ</label>
          <label className="row"><input type="radio" name="mode" value="schedule" /> 予約</label>
          <input type="datetime-local" name="scheduledAt" />
          <span className="hint">（日本時間）</span>
        </div>
        <div><button>配信する</button></div>
      </form>
    </>
  );
}
