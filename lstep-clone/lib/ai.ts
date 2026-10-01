import Anthropic from "@anthropic-ai/sdk";
import { all, get, getSetting, run } from "./db";
import { jstMonthStart } from "./format";
import type { Friend, Message } from "./types";

export const DEFAULT_SYSTEM_PROMPT = `あなたはLINE公式アカウントの担当者です。
- 丁寧で親しみやすい日本語で、LINEらしく短め（3〜5文程度）に返信してください。
- 分からないこと・個別対応が必要なことは推測で答えず「担当者から改めてご連絡します」と伝えてください。
- Markdown記法は使わないでください。`;

/** 選択できるモデルと料金（USD / 100万トークン） */
export const AI_MODELS = [
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5（最安）", input: 1, output: 5, cacheRead: 0.1 },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5（バランス）", input: 2, output: 10, cacheRead: 0.2 },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5（高品質）", input: 4, output: 20, cacheRead: 0.2 },
] as const;

const DEFAULT_MODEL = "claude-opus-5-5";
const HISTORY_LIMIT = 20;
const USD_JPY = 150;

export async function aiConfig() {
  return {
    enabled: (await getSetting("ai_enabled", "0")) === "1",
    model: (await getSetting("ai_model")) || DEFAULT_MODEL,
    monthlyLimit: Number(await getSetting("ai_monthly_limit", "100")),
    systemPrompt: (await getSetting("ai_system_prompt")) || DEFAULT_SYSTEM_PROMPT,
    knowledge: await getSetting("ai_knowledge"),
  };
}

export async function aiMonthlyUsage() {
  const rows = await all<{ model: string; n: number; input: number; output: number; cache_read: number }>(
    `SELECT model, COUNT(*) n, SUM(input_tokens) input, SUM(output_tokens) output, SUM(cache_read_tokens) cache_read
     FROM ai_usage WHERE created_at >= ? GROUP BY model`,
    jstMonthStart(),
  );
  let count = 0;
  let usd = 0;
  for (const r of rows) {
    count += r.n;
    const p = AI_MODELS.find((m) => m.id === r.model) ?? AI_MODELS[2];
    usd += (r.input * p.input + r.output * p.output + r.cache_read * p.cacheRead) / 1_000_000;
  }
  return { count, usd, jpy: usd * USD_JPY };
}

/** AI応答してよいか（キー設定済み・ON・月間上限内） */
export async function aiAvailable(): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY) return false;
  const cfg = await aiConfig();
  if (!cfg.enabled) return false;
  if (cfg.monthlyLimit > 0) {
    const row = await get<{ n: number }>("SELECT COUNT(*) n FROM ai_usage WHERE created_at >= ?", jstMonthStart());
    if ((row?.n ?? 0) >= cfg.monthlyLimit) return false;
  }
  return true;
}

async function history(friendId: number): Promise<Anthropic.Beta.BetaMessageParam[]> {
  const rows = (
    await all<Message>(
      "SELECT * FROM messages WHERE friend_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
      friendId,
      HISTORY_LIMIT,
    )
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
  const messages = await history(friend.id);
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") return null;

  const cfg = await aiConfig();
  // ナレッジ部分はプロンプトキャッシュで再利用し、入力コストを下げる
  const stable = [cfg.systemPrompt, cfg.knowledge && `# 参考情報（この内容に基づいて回答）\n${cfg.knowledge}`]
    .filter(Boolean)
    .join("\n\n");
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: stable, cache_control: { type: "ephemeral" } },
  ];
  if (friend.display_name) system.push({ type: "text", text: `相手の表示名: ${friend.display_name}` });

  const isHaiku = cfg.model.startsWith("claude-haiku");
  const client = new Anthropic();
  try {
    const res = await client.beta.messages.create({
      model: cfg.model,
      max_tokens: 2000,
      system,
      messages,
      // Haiku はeffort・サーバー側フォールバック非対応
      ...(isHaiku
        ? {}
        : {
            output_config: { effort: "low" as const },
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default" as const,
          }),
    });
    await run(
      "INSERT INTO ai_usage (friend_id, model, input_tokens, output_tokens, cache_read_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      friend.id,
      cfg.model,
      res.usage.input_tokens + (res.usage.cache_creation_input_tokens ?? 0),
      res.usage.output_tokens,
      res.usage.cache_read_input_tokens ?? 0,
      Date.now(),
    );
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
