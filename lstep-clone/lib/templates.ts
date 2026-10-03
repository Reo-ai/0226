// 導線テンプレート：よくある配信の流れを、ボタン1つで「タグ・フォーム・ステップ配信・自動応答・友だち情報欄」ごと作る
// 本文中の {{form:@フォーム名}} は、導入時に作ったフォームの番号に置き換える
import { all, get, run } from "./db";
import type { FormField } from "./types";

interface TplStep {
  /** 開始からの日数（fixed=true なら開始日の0時から数えた分） */
  minutes: number;
  fixed?: boolean;
  content: string;
  /** このタグがある人だけ（has）／ない人だけ（not）に送る */
  cond?: { tag: string; type: "has" | "not" };
}

export interface FunnelTemplate {
  key: string;
  name: string;
  summary: string;
  /** 作るもの（画面での説明用） */
  makes: string[];
  tags: string[];
  fields?: string[];
  forms?: { title: string; description: string; fields: FormField[]; addTag?: string; thanks: string }[];
  autoReplies?: { keyword: string; match: "exact" | "contains"; reply: string; addTag?: string }[];
  scenarios?: { name: string; trigger: "follow" | "tag"; triggerTag?: string; stopTag?: string; steps: TplStep[] }[];
}

const DAY = 24 * 60;
const at = (day: number, hour: number) => day * DAY + hour * 60;
const f = (label: string, type: FormField["type"], options: string[] = [], required = false): FormField => ({
  label,
  type,
  options,
  required,
});

export const TEMPLATES: FunnelTemplate[] = [
  {
    key: "welcome",
    name: "あいさつ＋アンケート",
    summary: "友だち追加の直後にあいさつし、かんたんなアンケートで興味を聞いて、答えに合わせてタグを付けます。",
    makes: ["タグ「アンケート回答済み」", "回答フォーム「はじめてのアンケート」", "友だち情報欄「職業」「興味」", "ステップ配信（追加直後・翌日）"],
    tags: ["アンケート回答済み"],
    fields: ["職業", "興味"],
    forms: [
      {
        title: "はじめてのアンケート",
        description: "1分で終わります。あなたに合った情報をお届けするために教えてください。",
        fields: [f("職業", "select", ["会社員", "自営業・フリーランス", "学生", "主婦・主夫", "その他"], true), f("興味", "checkbox", ["副業", "スキルアップ", "習慣づくり", "その他"])],
        addTag: "アンケート回答済み",
        thanks: "回答ありがとうございます！これからお役に立つ情報をお届けします。",
      },
    ],
    scenarios: [
      {
        name: "あいさつ＋アンケート",
        trigger: "follow",
        stopTag: "アンケート回答済み",
        steps: [
          {
            minutes: 0,
            content:
              "{{name}}さん、友だち追加ありがとうございます！\n---\nあなたに合った情報をお届けしたいので、1分のアンケートにご協力ください🙏\n{{form:@はじめてのアンケート}}",
          },
          {
            minutes: at(1, 20),
            fixed: true,
            cond: { tag: "アンケート回答済み", type: "not" },
            content: "昨日のアンケート、まだでしたらぜひ✍️（1分で終わります）\n{{form:@はじめてのアンケート}}",
          },
        ],
      },
    ],
  },
  {
    key: "sales",
    name: "基本の販売導線",
    summary: "「プレゼント」と送った人に特典を渡し、数日かけて価値を伝えてから商品を案内します。購入済みタグが付いたら止まります。",
    makes: ["タグ「プレゼント受取」「購入済み」", "自動応答「プレゼント」", "ステップ配信（0・1・3・5・7日目）"],
    tags: ["プレゼント受取", "購入済み"],
    autoReplies: [
      {
        keyword: "プレゼント",
        match: "contains",
        reply: "お待たせしました🎁 特典はこちらです！\n（ここに特典のURLを入れてください）",
        addTag: "プレゼント受取",
      },
    ],
    scenarios: [
      {
        name: "基本の販売導線",
        trigger: "tag",
        triggerTag: "プレゼント受取",
        stopTag: "購入済み",
        steps: [
          { minutes: at(1, 20), fixed: true, content: "特典は見ていただけましたか？\nよくある悩みと、その解決のヒントをお話しします。\n（ここに1日目の内容）" },
          { minutes: at(3, 20), fixed: true, content: "実際に成果が出た方の例をご紹介します。\n（ここにお客様の声）" },
          {
            minutes: at(5, 20),
            fixed: true,
            content: "お待たせしました。もっと深く学びたい方向けのご案内です。\n---\nカード: ご案内\n詳しい内容はこちらからご覧ください\nボタン: 詳しく見る=https://example.com / 質問する=質問があります",
          },
          { minutes: at(7, 20), fixed: true, content: "ご案内の受付はまもなく終了します。\n気になることがあれば、このトークで気軽に聞いてくださいね。" },
        ],
      },
    ],
  },
  {
    key: "seminar",
    name: "説明会・セミナー集客",
    summary: "申込フォームで受け付け、申込者に開催前のリマインドを送ります。申込んでいない人には案内を2回送ります。",
    makes: ["タグ「説明会申込」", "回答フォーム「説明会の申込」", "友だち情報欄「参加希望日」", "ステップ配信（案内・リマインド）"],
    tags: ["説明会申込"],
    fields: ["参加希望日"],
    forms: [
      {
        title: "説明会の申込",
        description: "参加したい日を選んでください。",
        fields: [f("参加希望日", "radio", ["第1回", "第2回"], true), f("聞きたいこと", "textarea")],
        addTag: "説明会申込",
        thanks: "お申し込みありがとうございます！前日にこのLINEでお知らせします。",
      },
    ],
    scenarios: [
      {
        name: "説明会のご案内",
        trigger: "follow",
        stopTag: "説明会申込",
        steps: [
          { minutes: at(0, 0) + 10, content: "無料の説明会を開きます📣\nお申し込みはこちらから\n{{form:@説明会の申込}}" },
          { minutes: at(2, 20), fixed: true, content: "説明会の席がうまってきました。ご興味があればお早めに！\n{{form:@説明会の申込}}" },
        ],
      },
      {
        name: "説明会の申込者フォロー",
        trigger: "tag",
        triggerTag: "説明会申込",
        steps: [
          { minutes: 0, content: "{{name}}さん、お申し込みを受け付けました✅\nご希望の日：{{field:参加希望日}}" },
          { minutes: at(1, 9), fixed: true, content: "説明会が近づいてきました。当日はこのLINEで参加URLをお送りします。" },
        ],
      },
    ],
  },
  {
    key: "faq",
    name: "よくある質問の自動応答",
    summary: "料金・時間・問い合わせなど、よく聞かれる言葉に自動で返事をします。内容はあとで書き換えてください。",
    makes: ["自動応答「料金」「営業時間」「問い合わせ」「キャンセル」"],
    tags: [],
    autoReplies: [
      { keyword: "料金", match: "contains", reply: "料金についてのご案内です。\n（ここに料金を書いてください）" },
      { keyword: "営業時間", match: "contains", reply: "受付時間は平日10時〜18時です。\n（ここを書き換えてください）" },
      { keyword: "問い合わせ", match: "contains", reply: "お問い合わせありがとうございます。内容をこのトークに送ってください。担当者からお返事します。" },
      { keyword: "キャンセル", match: "contains", reply: "キャンセルのご連絡ありがとうございます。担当者が確認してお返事します。" },
    ],
  },
];

/** テンプレートを導入する。同じ名前のタグ・情報欄は使い回し、それ以外は新しく作る。作ったステップ配信の番号を返す */
export async function installTemplate(key: string): Promise<{ scenarioIds: number[]; again: boolean }> {
  const t = TEMPLATES.find((x) => x.key === key);
  if (!t) throw new Error("テンプレートが見つかりません");
  const now = Date.now();
  // 2回目以降は同じ配信が2重に動かないよう、名前に「（コピー）」を付けて停止の状態で作る
  const again = (await installedKeys()).has(key);
  const suffix = again ? "（コピー）" : "";

  const tagIds = new Map<string, number>();
  const needTags = new Set<string>([
    ...t.tags,
    ...(t.forms ?? []).flatMap((x) => (x.addTag ? [x.addTag] : [])),
    ...(t.autoReplies ?? []).flatMap((x) => (x.addTag ? [x.addTag] : [])),
    ...(t.scenarios ?? []).flatMap((s) => [s.triggerTag, s.stopTag, ...s.steps.map((st) => st.cond?.tag)].filter((v): v is string => !!v)),
  ]);
  for (const name of needTags) {
    await run("INSERT OR IGNORE INTO tags (name) VALUES (?)", name);
    const row = await get<{ id: number }>("SELECT id FROM tags WHERE name = ?", name);
    if (row) tagIds.set(name, row.id);
  }
  const tag = (name?: string) => (name ? (tagIds.get(name) ?? null) : null);

  for (const name of t.fields ?? []) {
    await run("INSERT OR IGNORE INTO custom_fields (name, created_at) VALUES (?, ?)", name, now);
  }

  const formIds = new Map<string, number>();
  for (const fm of t.forms ?? []) {
    const { lastId } = await run(
      "INSERT INTO forms (title, description, fields, add_tag_id, thanks_message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      fm.title + suffix,
      fm.description,
      JSON.stringify(fm.fields),
      tag(fm.addTag),
      fm.thanks,
      now,
    );
    formIds.set(fm.title, lastId);
  }
  const fill = (content: string) => content.replace(/\{\{form:@([^}]+)\}\}/g, (m, title: string) => (formIds.has(title) ? `{{form:${formIds.get(title)}}}` : m));

  for (const ar of t.autoReplies ?? []) {
    // 同じ言葉の応答がすでにあれば作らない（上書きしない）
    const exists = await get("SELECT id FROM auto_replies WHERE keyword = ?", ar.keyword);
    if (exists) continue;
    await run("INSERT INTO auto_replies (keyword, match_type, reply, add_tag_id) VALUES (?, ?, ?, ?)", ar.keyword, ar.match, fill(ar.reply), tag(ar.addTag));
  }

  const scenarioIds: number[] = [];
  for (const sc of t.scenarios ?? []) {
    const { lastId } = await run(
      "INSERT INTO scenarios (name, trigger, trigger_tag_id, stop_tag_id, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      sc.name + suffix,
      sc.trigger,
      tag(sc.triggerTag),
      tag(sc.stopTag),
      again ? 0 : 1,
      now,
    );
    scenarioIds.push(lastId);
    for (const st of sc.steps) {
      await run(
        "INSERT INTO scenario_steps (scenario_id, delay_minutes, delivery, fixed_time, content, cond_tag_id, cond_type) VALUES (?, ?, 'push', ?, ?, ?, ?)",
        lastId,
        st.minutes,
        st.fixed ? 1 : 0,
        fill(st.content),
        tag(st.cond?.tag),
        st.cond?.type ?? null,
      );
    }
  }
  return { scenarioIds, again };
}

/** すでに導入したことがあるか（同じ名前のステップ配信・フォームがあるか）の目安 */
export async function installedKeys(): Promise<Set<string>> {
  const names = new Set((await all<{ name: string }>("SELECT name FROM scenarios")).map((r) => r.name));
  const titles = new Set((await all<{ title: string }>("SELECT title FROM forms")).map((r) => r.title));
  const keywords = new Set((await all<{ keyword: string }>("SELECT keyword FROM auto_replies")).map((r) => r.keyword));
  return new Set(
    TEMPLATES.filter(
      (t) =>
        (t.scenarios ?? []).some((s) => names.has(s.name)) ||
        (t.forms ?? []).some((x) => titles.has(x.title)) ||
        (!t.scenarios?.length && !t.forms?.length && (t.autoReplies ?? []).every((a) => keywords.has(a.keyword))),
    ).map((t) => t.key),
  );
}
