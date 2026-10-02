import { baseUrl } from "./env";
import { MAX_BUBBLES, type LineMessage } from "./line";
import type { Friend, MessageSource } from "./types";

/**
 * 本文の書式
 * - 「---」だけの行で吹き出しを区切る（最大5つ。何個でも1通としてカウント）
 * - 「image:https://...」だけの吹き出しは画像として送る
 * - 変数: {{name}} 表示名 / {{link:CODE}} 計測リンク / {{form:ID}} 回答フォーム
 */
const SEPARATOR = /^\s*---\s*$/m;
const IMAGE = /^image:\s*(https:\/\/\S+)$/;

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
  }
  return null;
}

/** 友だちごとに差し替えが必要か（必要なら一斉送信でもmulticastできない） */
export function isPersonalized(content: string): boolean {
  return /\{\{\s*(name|link:[\w-]+|form:\d+)\s*\}\}/.test(content);
}

export function renderVars(content: string, friend: Friend | null, source: MessageSource): string {
  const base = baseUrl();
  return content
    .replace(/\{\{\s*name\s*\}\}/g, friend?.display_name || "")
    .replace(/\{\{\s*link:([\w-]+)\s*\}\}/g, (_, code: string) => {
      const params = new URLSearchParams({ s: source });
      if (friend) params.set("f", friend.token);
      return `${base}/r/${code}?${params}`;
    })
    .replace(/\{\{\s*form:(\d+)\s*\}\}/g, (_, id: string) => {
      return friend ? `${base}/f/${id}?f=${friend.token}` : `${base}/f/${id}`;
    });
}

export interface Rendered {
  messages: LineMessage[];
  /** 履歴表示用のテキスト */
  text: string;
}

export function render(content: string, friend: Friend | null, source: MessageSource): Rendered {
  const blocks = splitBlocks(renderVars(content, friend, source)).slice(0, MAX_BUBBLES);
  const messages: LineMessage[] = blocks.map((b) => {
    const img = b.match(IMAGE);
    return img
      ? { type: "image", originalContentUrl: img[1], previewImageUrl: img[1] }
      : { type: "text", text: b };
  });
  return { messages, text: blocks.join("\n---\n") };
}
