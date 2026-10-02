import Link from "next/link";
import { guestViewEnabled, isAuthed } from "@/lib/auth";
import { startGuestView } from "@/lib/actions";
import "./home.css";

export const dynamic = "force-dynamic";

const FEATURES = [
  ["ステップ配信", "友だち追加・タグ付与をきっかけに「◯日後の20:00」などで自動配信。購入済みタグで自動停止。"],
  ["キーワード自動応答", "「特典」「質問」などの言葉に自動で返信。応答メッセージなので通数0。"],
  ["タグ・セグメント", "リンククリック・フォーム回答・流入経路・リッチメニューで自動タグ付け。"],
  ["リッチメニュー", "タグ別に自動で切り替え。ボタンを押すと情報が届く“通数0”の設計に。"],
  ["回答フォーム・計測リンク", "誰が回答・クリックしたかまで分かるフォームと計測URL。"],
  ["分析", "友だち推移・ブロック率・配信ごとのクリック率・シナリオ離脱率をひと目で。"],
] as const;

export default async function Home() {
  const authed = await isAuthed();
  return (
    <div className="home">
      <header className="home-head">
        <div className="home-brand">
          <span className="home-logo">S</span>スキルステップ
        </div>
        <div className="row">
          {!authed && guestViewEnabled() && (
            <form action={startGuestView}>
              <button className="ghost">ログインせずに見る</button>
            </form>
          )}
          <Link className="btn" href={authed ? "/dashboard" : "/login"}>
            {authed ? "管理画面へ" : "ログイン"}
          </Link>
        </div>
      </header>

      <section className="home-hero">
        <p className="home-kicker">LINE公式アカウントの配信ツール</p>
        <h1>
          ステップ配信も、自動応答も、
          <br />
          月額0円で。
        </h1>
        <p className="home-lead">
          友だち追加から教育・案内・購入後のフォローまで、公式LINEの導線を自動で回すためのツールです。
          相手からの反応に返す「応答メッセージ」を最大限使い、無料の配信通数を節約します。
        </p>
        {!authed && guestViewEnabled() && (
          <form action={startGuestView} className="home-cta">
            <button>ログインせずに管理画面を見てみる</button>
          </form>
        )}
      </section>

      <section className="home-grid">
        {FEATURES.map(([title, body]) => (
          <div key={title} className="panel">
            <h2>{title}</h2>
            <p className="muted">{body}</p>
          </div>
        ))}
      </section>

      <footer className="home-foot muted">© スキルステップ</footer>
    </div>
  );
}
