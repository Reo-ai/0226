import Link from "next/link";
import { baseUrl } from "@/lib/env";

// 使い方（招待された人・構築代行のお客さんに渡せる手順書）
export default function GuidePage() {
  const base = baseUrl();
  return (
    <>
      <h1>使い方</h1>
      <div className="panel stack guide">
        <h2>はじめに（最初の1回だけ）</h2>
        <ol>
          <li>招待リンクを開き、「LINEでログインして始める」を押す（あなた専用の管理画面ができます）</li>
          <li>
            <a href="https://manager.line.biz/" target="_blank" rel="noreferrer">
              公式LINEの管理画面 ↗
            </a>
            で、右上の「設定」→ 左の「Messaging API」を開く。まだ「利用する」になっていなければ、「Messaging APIを利用する」を押してプロバイダーを選ぶ
          </li>
          <li>
            「Channel ID」と「Channel secret」をコピーして、この画面の <Link href="/line">LINE連携</Link> に貼り付け、「公式LINEと連携する」を押す
          </li>
          <li>
            公式LINEの管理画面「設定」→「応答設定」で、<b>Webhook を オン</b>、<b>応答メッセージ・あいさつメッセージを オフ</b>
            にする（このツールが返事をするため。オンのままだと二重に返事が届きます）
          </li>
        </ol>
        <p className="hint">連携より前の友だち一覧・トーク履歴は LINE の仕様で取り込めません。連携した後の友だち追加・メッセージから記録されます。</p>
      </div>

      <div className="panel stack guide">
        <h2>できること</h2>
        <table>
          <tbody>
            <tr>
              <td><Link href="/friends">友だち</Link></td>
              <td>友だちの一覧・トーク・タグ・メモ。友だちを開くと「ひと目でわかるまとめ」と個別メッセージ</td>
            </tr>
            <tr>
              <td><Link href="/scenarios">ステップ配信</Link></td>
              <td>友だち追加やタグをきっかけに「○日後の20:00」などで自動配信。「送る条件」でタグがある人／ない人だけに分岐</td>
            </tr>
            <tr>
              <td><Link href="/broadcasts">一斉配信</Link></td>
              <td>全員またはタグで絞って一斉に送る。予約も可</td>
            </tr>
            <tr>
              <td><Link href="/auto-replies">自動応答</Link></td>
              <td>「特典」「質問」などの言葉に自動で返事（返事は配信数を使いません）</td>
            </tr>
            <tr>
              <td><Link href="/rich-menus">リッチメニュー</Link></td>
              <td>トーク画面下のメニュー。タグ別の出し分け、タブで切り替えるメニューも作れます</td>
            </tr>
            <tr>
              <td><Link href="/forms">回答フォーム</Link></td>
              <td>アンケートや申込フォーム。回答した人にタグを付けられます</td>
            </tr>
            <tr>
              <td><Link href="/sources">流入経路</Link></td>
              <td>Instagram・TikTok などの登録用URL/QR。どこから友だちになったかを記録し、タグを付けます</td>
            </tr>
            <tr>
              <td><Link href="/links">計測リンク</Link></td>
              <td>誰がリンクを押したかを記録し、押した人にタグを付けます</td>
            </tr>
            <tr>
              <td>習慣トラッカー</td>
              <td>友だちが「習慣」と送ると、続ける行動・通知時刻を決めて、「できた」で連続日数とバッジが貯まります</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="panel stack guide">
        <h2>本文の書き方</h2>
        <pre className="pre" style={{ background: "var(--bg)", padding: 12, borderRadius: 8, fontSize: 13 }}>{`{{name}}さん、こんにちは！        ← {{name}} は友だちの名前に置き換わる
---                                ← 「---」だけの行で吹き出しを分ける（最大5つ）
image:https://〜/banner.jpg        ← 画像
---
カード: 講座のご案内                ← 画像とボタン付きのカード
3日で使えるようになる講座です
画像: https://〜/card.jpg
ボタン: 詳しく見る=https://〜 / 質問する=質問
選択肢: はい / いいえ / あとで       ← タップで送れるボタン
---
{{form:1}}  {{booking}}  {{field:職業}}  ← フォーム・予約ページのURL、友だち情報欄の値`}</pre>
        <p className="hint">本文の入力欄の下の「プレビュー」で見た目と LINE の形式を確認、「自分にテスト送信」であなたの LINE にだけ届きます。</p>
      </div>

      <div className="panel stack guide">
        <h2>配信数（料金）について</h2>
        <ul>
          <li>LINE公式アカウントの無料プランは月200通まで。「1人に1回送る＝1通」です</li>
          <li>友だちからの反応への返事（自動応答・友だち追加のあいさつ・メニューのボタン）は通数を使いません</li>
          <li>月の上限に達すると、ステップ配信は自動で「相手が話しかけた時に無料で届ける」に切り替わります</li>
          <li>上限は <Link href="/settings">設定・AI</Link> の「プッシュ上限」で、契約プランの通数に合わせて変えてください</li>
        </ul>
      </div>

      <div className="panel stack guide">
        <h2>困ったとき</h2>
        <ul>
          <li>返事が来ない：公式LINEの「応答設定」で Webhook がオンか、LINE連携の画面で「連携中」になっているかを確認</li>
          <li>返事が二重に届く：公式LINEの「応答メッセージ」「あいさつメッセージ」をオフにする</li>
          <li>ログインできない：招待リンクは1回だけ・7日間有効です。招待した人に新しいリンクをもらってください</li>
        </ul>
        <p className="hint">このツールの住所：{base}</p>
      </div>
    </>
  );
}
