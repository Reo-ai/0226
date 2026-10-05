import { baseUrl } from "./env";
import { wsQuery } from "./workspace";
import { MAX_BUBBLES, type LineMessage } from "./line";
import type { Friend, MessageSource } from "./types";

/**
 * 本文の書式
 * - 「---」だけの行で吹き出しを区切る（最大5つ。何個でも1通としてカウント）
 * - 「image:https://...」だけの吹き出しは画像として送る
 * - 変数: {{name}} 表示名 / {{link:CODE}} 計測リンク / {{form:ID}} 回答フォーム / {{booking}} 予約ページ
 * - 「選択肢: A / B / C」の行 → 吹き出しの下にタップで送れるボタン（クイックリプライ。最大13個）
 *     「表示=送る文字」と書くと、ボタンの表示と送る文字を分けられる
 * - 「カード: タイトル」で始まる吹き出し → 画像とボタン付きのカード。1つの吹き出しに複数書くと横スクロールのカルーセル
 *     カード: タイトル
 *     本文（複数行可）
 *     画像: https://...（任意）
 *     ボタン: 講座を見る=https://... / 質問する=質問（最大3つ。URLなら開く、それ以外は文字を送る）
 */
const SEPARATOR = /^\s*---\s*$/m;
const IMAGE = /^image:\s*(https:\/\/\S+)$/;
const CHOICES = /^\s*選択肢[:：]\s*(.+)$/m;
const CARD = /^\s*カード[:：]/m;

export function splitBlocks(content: string): string[] {
  return content
    .split(SEPARATOR)
    .map((b) => b.trim())
    .filter(Boolean);
}

export function validateContent(content: string): string | null {
  const blocks = splitBlocks(content);
  if (blocks.length === 0) return "本文が空です";
  if (blocks.length > MAX_BUBBLES) return `吹き出しは最大${MAX_BUBBLES}つまでです（現在${blocks.length}）`;
  for (const b of blocks) {
    if (b.startsWith("image:") && !IMAGE.test(b)) return "画像は image:https://... の形式で指定してください";
    if (b.length > 5000) return "1つの吹き出しは5000文字までです";
    const choices = b.match(CHOICES);
    if (choices && splitItems(choices[1]).length > 13) return "選択肢は13個までです";
    if (CARD.test(b)) {
      const cards = parseCards(b.replace(CHOICES, ""));
      if (cards.length > 12) return "カードは1つの吹き出しに12枚までです";
      for (const c of cards) {
        if (!c.title) return "カードのタイトルが空です（「カード: タイトル」）";
        if (c.buttons.length > 3) return "カードのボタンは3つまでです";
        if (c.image && !/^https:\/\//.test(c.image)) return "カードの画像は https:// で始まるURLにしてください";
      }
    }
  }
  return null;
}

function splitItems(s: string): string[] {
  return s
    // URL の「/」で切れないよう、前後に空白がある「 / 」か全角「／」だけで区切る
    .split(/\s+\/\s+|／/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** 「表示=送る文字」を分ける（= が無ければ同じ文字） */
function labelValue(item: string): { label: string; value: string } {
  const i = item.indexOf("=");
  if (i < 0) return { label: item, value: item };
  return { label: item.slice(0, i).trim(), value: item.slice(i + 1).trim() };
}

interface Card {
  title: string;
  body: string;
  image: string | null;
  buttons: { label: string; value: string }[];
}

function parseCards(block: string): Card[] {
  return block
    .split(CARD)
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const lines = c.split("\n");
      const title = lines.shift()?.trim() ?? "";
      let image: string | null = null;
      let buttons: Card["buttons"] = [];
      const body: string[] = [];
      for (const line of lines) {
        const img = line.match(/^\s*画像[:：]\s*(\S+)/);
        const btn = line.match(/^\s*ボタン[:：]\s*(.+)$/);
        if (img) image = img[1];
        else if (btn) buttons = splitItems(btn[1]).map(labelValue);
        else body.push(line);
      }
      return { title, body: body.join("\n").trim(), image, buttons };
    });
}

/** カード1枚を LINE の Flex Message の bubble にする */
function cardBubble(c: Card): object {
  const isUrl = (v: string) => /^https?:\/\//.test(v);
  return {
    type: "bubble",
    ...(c.image ? { hero: { type: "image", url: c.image, size: "full", aspectRatio: "20:13", aspectMode: "cover" } } : {}),
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        { type: "text", text: c.title.slice(0, 80), weight: "bold", size: "lg", wrap: true },
        ...(c.body ? [{ type: "text", text: c.body.slice(0, 1000), size: "sm", color: "#555555", wrap: true }] : []),
      ],
    },
    ...(c.buttons.length
      ? {
          footer: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: c.buttons.map((b, i) => ({
              type: "button",
              style: i === 0 ? "primary" : "secondary",
              color: i === 0 ? "#06c755" : undefined,
              height: "sm",
              action: isUrl(b.value)
                ? { type: "uri", label: b.label.slice(0, 20), uri: b.value }
                : { type: "message", label: b.label.slice(0, 20), text: b.value.slice(0, 300) },
            })),
          },
        }
      : {}),
  };
}

/** 友だちごとに差し替えが必要か（必要なら一斉送信でもmulticastできない） */
export function isPersonalized(content: string): boolean {
  return /\{\{\s*(name|booking|link:[\w-]+|form:\d+|field:[^}]+)\s*\}\}/.test(content);
}

/** ws: どのワークスペースの友だち向けか（公開ページの URL に ?w= を付ける） */
export function renderVars(
  content: string,
  friend: Friend | null,
  source: MessageSource,
  ws = "main",
  fields: Record<string, string> = {},
  refId: number | null = null,
): string {
  const base = baseUrl();
  const w = wsQuery(ws);
  return content
    .replace(/\{\{\s*name\s*\}\}/g, friend?.display_name || "")
    // 友だちごとのトークン（購入者限定ページ /p/ などで本人を確かめる）
    .replace(/\{\{\s*token\s*\}\}/g, friend?.token ?? "")
    .replace(/\{\{\s*field:([^}]+?)\s*\}\}/g, (_, name: string) => fields[name.trim()] ?? "")
    .replace(/\{\{\s*link:([\w-]+)\s*\}\}/g, (_, code: string) => {
      const params = new URLSearchParams({ s: source });
      if (friend) params.set("f", friend.token);
      // どの配信（一斉配信・ステップ）から押されたかを残す（配信ごとの成果に使う）
      if (refId) params.set("m", String(refId));
      return `${base}/r/${code}?${params}${w ? `&${w}` : ""}`;
    })
    .replace(/\{\{\s*form:(\d+)\s*\}\}/g, (_, id: string) => {
      const q = [friend ? `f=${friend.token}` : "", w].filter(Boolean).join("&");
      return `${base}/f/${id}${q ? `?${q}` : ""}`;
    })
    .replace(/\{\{\s*booking\s*\}\}/g, () => `${base}/b/${friend?.token ?? "open"}${w ? `?${w}` : ""}`);
}

export interface Rendered {
  messages: LineMessage[];
  /** 履歴表示用のテキスト */
  text: string;
}

export function render(
  content: string,
  friend: Friend | null,
  source: MessageSource,
  ws = "main",
  fields: Record<string, string> = {},
  refId: number | null = null,
): Rendered {
  const blocks = splitBlocks(renderVars(content, friend, source, ws, fields, refId)).slice(0, MAX_BUBBLES);
  const messages: LineMessage[] = blocks.map((raw) => {
    const choices = raw.match(CHOICES);
    const b = raw.replace(CHOICES, "").trim();
    const img = b.match(IMAGE);
    let msg: LineMessage;
    if (img) {
      msg = { type: "image", originalContentUrl: img[1], previewImageUrl: img[1] };
    } else if (CARD.test(b)) {
      const cards = parseCards(b);
      msg = {
        type: "flex",
        altText: cards.map((c) => c.title).join(" / ").slice(0, 400) || "メッセージ",
        contents: cards.length === 1 ? cardBubble(cards[0]) : { type: "carousel", contents: cards.slice(0, 12).map(cardBubble) },
      };
    } else {
      msg = { type: "text", text: b || " " };
    }
    if (choices) {
      msg.quickReply = {
        items: splitItems(choices[1])
          .slice(0, 13)
          .map(labelValue)
          .map(({ label, value }) => ({ type: "action", action: { type: "message", label: label.slice(0, 20), text: value.slice(0, 300) } })),
      };
    }
    return msg;
  });
  return { messages, text: blocks.join("\n---\n") };
}
