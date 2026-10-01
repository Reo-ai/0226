import Anthropic from "@anthropic-ai/sdk";
import { db, getSetting } from "./db";
import type { Friend, Message } from "./types";

export const DEFAULT_SYSTEM_PROMPT = `あなたはLINE公式アカウントの担当者です。
- 丁寧で親しみやすい日本語で、LINEらしく短め（3〜5文程度）に返信してください。
- 分からないこと・個別対応が必要なことは推測で答えず「担当者から改めてご連絡します」と伝えてください。
- Markdown記法は使わないでください。`;

const HISTORY_LIMIT = 20;

export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && getSetting("ai_enabled", "0") === "1";
}

function history(friendId: number): Anthropic.Beta.BetaMessageParam[] {
  const rows = (
    db()
      .prepare("SELECT * FROM messages WHERE friend_id = ? ORDER BY created_at DESC, id DESC LIMIT ?")
      .all(friendId, HISTORY_LIMIT) as Message[]
  ).reverse();
  const msgs: Anthropic.Beta.BetaMessageParam[] = rows.map((m) => ({
    role: m.direction === "in" ? "user" : "assistant",
    content: m.content,
  }));
  // 先頭は user である必要がある
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  return msgs;
}

/** 友だちの直近の会話履歴からAI返信を生成する。返せない場合は null */
export async function generateAiReply(friend: Friend): Promise<string | null> {
  const messages = history(friend.id);
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") return null;

  const knowledge = getSetting("ai_knowledge");
  const system = [
    getSetting("ai_system_prompt") || DEFAULT_SYSTEM_PROMPT,
    knowledge && `# 参考情報（この内容に基づいて回答）\n${knowledge}`,
    friend.display_name && `相手の表示名: ${friend.display_name}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const client = new Anthropic();
  try {
    const res = await client.beta.messages.create({
      model: getSetting("ai_model") || "claude-opus-5-5",
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system,
      messages,
    });
    if (res.stop_reason === "refusal") return null;
    const text = res.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return text || null;
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      console.error(`Claude API error ${e.status}:`, e.message);
    } else {
      console.error(e);
    }
    return null;
  }
}
