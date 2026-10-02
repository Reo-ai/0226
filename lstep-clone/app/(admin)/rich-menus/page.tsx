import { createHabitMenu, createRichMenu, createTabMenus, deleteRichMenu, setDefaultMenu } from "@/lib/actions";
import { all } from "@/lib/db";
import { LAYOUTS, layoutOf } from "@/lib/richmenu";
import type { RichMenu, Tag } from "@/lib/types";
import { ErrorBox, TagSelect } from "@/lib/ui";
import AreaEditor from "./AreaEditor";

export default async function RichMenusPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const menus = await all<RichMenu & { users: number }>(
    "SELECT rm.*, (SELECT COUNT(*) FROM friends f WHERE f.rich_menu_id = rm.id AND f.blocked = 0) users FROM rich_menus rm ORDER BY rm.created_at DESC",
  );
  const tags = await all<Tag>("SELECT * FROM tags ORDER BY name");
  const forms = await all<{ id: number; name: string }>("SELECT id, title name FROM forms ORDER BY id DESC");
  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  return (
    <>
      <h1>リッチメニュー</h1>
      <p className="muted">
        トーク画面下部のメニュー。タグを指定すると、そのタグが付いた人だけメニューが切り替わります（切替は通数を消費しません）。
      </p>
      <ErrorBox error={error} />
      <form action={createTabMenus} className="panel row" style={{ justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0 }}>タブで切り替えるメニュー（冒険メニュー ⇄ 習慣メニュー）</h2>
          <div className="hint">今の通常メニューの上にタブを付けた「冒険メニュー」と「習慣メニュー」を作り、冒険メニューを既定にします</div>
        </div>
        <button>ワンクリックで作成</button>
      </form>
      <form action={createHabitMenu} className="panel row" style={{ justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0 }}>習慣トラッカーのメニュー</h2>
          <div className="hint">「できた」「記録」「習慣の設定」の3ボタンを作り、全員の既定メニューにします</div>
        </div>
        <button>ワンクリックで作成</button>
      </form>
      <form action={createRichMenu} className="panel stack">
        <h2>新規作成</h2>
        <div className="row">
          <input name="name" placeholder="管理名" required />
          <input name="chatBarText" placeholder="メニューバーの文字（14字まで）" maxLength={14} defaultValue="メニュー" />
          表示対象タグ: <TagSelect tags={tags} name="tagId" empty="なし（デフォルト用）" />
        </div>
        <AreaEditor layouts={LAYOUTS} tags={tags} forms={forms} />
        <input type="file" name="image" accept="image/png,image/jpeg" required />
        <div><button>LINEに登録</button></div>
      </form>
      <div className="grid">
        {menus.map((m) => (
          <div key={m.id} className="panel stack">
            <b>{m.name}</b>
            <img className="thumb" src={m.image_data} alt="" />
            <div className="hint">
              {layoutOf(m.layout).label} / {m.tag_id ? `タグ「${tagName.get(m.tag_id)}」の人に表示（${m.users}人）` : "タグなし"}
            </div>
            <div className="row">
              <form action={setDefaultMenu}>
                <input type="hidden" name="id" value={m.id} />
                <button className={m.is_default ? "small" : "ghost small"}>{m.is_default ? "デフォルト（解除）" : "デフォルトにする"}</button>
              </form>
              <form action={deleteRichMenu}>
                <input type="hidden" name="id" value={m.id} />
                <button className="danger small">削除</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
