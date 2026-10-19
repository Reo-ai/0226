import Anthropic from "@anthropic-ai/sdk";
import { all, get, getSetting, run } from "./db";
import { jstMonthStart } from "./format";

/** 選択できるモデルと料金（USD / 100万トークン） */
export const AI_MODELS = [
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5（最安）", input: 1, output: 5 },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5（バランス）", input: 2, output: 10 },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5（高品質）", input: 4, output: 20 },
] as const;

const DEFAULT_MODEL = "claude-sonnet-5-5";
const USD_JPY = 150;

export const COMPLIANCE_RULES = `# 守るべきルール（日本の広告規制）
- 冒頭または末尾に必ず「PR」または「広告」の表記を入れる（ステマ規制）
- 健康食品・サプリ・化粧品は「治る」「痩せる」「効く」など効能効果の断定をしない（薬機法）。体験は「個人の感想」と明記
- 金融・投資・副業は「必ず儲かる」「元本保証」など断定・誇大表現をしない
- 実際に使っていない商品の体験談をでっち上げない。使用前提の表現は「〜な人に向いている」などに言い換える
- 「No.1」「最安」など根拠が必要な表現は使わない`;

export async function aiConfig() {
  return {
    model: (await getSetting("ai_model")) || DEFAULT_MODEL,
    monthlyLimit: Number(await getSetting("ai_monthly_limit", "200")),
    profile: await getSetting("profile"),
  };
}

export async function aiMonthlyUsage() {
  const rows = await all<{ model: string; n: number; input: number; output: number }>(
    `SELECT model, COUNT(*) n, SUM(input_tokens) input, SUM(output_tokens) output
     FROM ai_usage WHERE created_at >= ? GROUP BY model`,
    jstMonthStart(),
  );
  let count = 0;
  let usd = 0;
  for (const r of rows) {
    count += r.n;
    const p = AI_MODELS.find((m) => m.id === r.model) ?? AI_MODELS[2];
    usd += (r.input * p.input + r.output * p.output) / 1_000_000;
  }
  return { count, usd, jpy: usd * USD_JPY };
}

export class AiError extends Error {}

/** AIで文章を生成する。使えない状態なら AiError を投げる */
export async function generate(purpose: string, system: string, prompt: string, maxTokens = 4000): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiError("ANTHROPIC_API_KEY が未設定です");
  const cfg = await aiConfig();
  if (cfg.monthlyLimit > 0) {
    const row = await get<{ n: number }>("SELECT COUNT(*) n FROM ai_usage WHERE created_at >= ?", jstMonthStart());
    if ((row?.n ?? 0) >= cfg.monthlyLimit) throw new AiError("今月のAI利用回数の上限に達しました（設定で変更できます）");
  }
  const systemText = [system, cfg.profile && `# 発信者のプロフィール\n${cfg.profile}`].filter(Boolean).join("\n\n");

  const isHaiku = cfg.model.startsWith("claude-haiku");
  const client = new Anthropic();
  let res: Anthropic.Beta.BetaMessage;
  try {
    res = await client.beta.messages.create({
      model: cfg.model,
      max_tokens: maxTokens,
      system: systemText,
      messages: [{ role: "user", content: prompt }],
      // Haiku はeffort・サーバー側フォールバック非対応
      ...(isHaiku
        ? {}
        : {
            output_config: { effort: "low" as const },
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default" as const,
          }),
    });
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      console.error(`Claude API error ${e.status}:`, e.message);
      throw new AiError(`AIの呼び出しに失敗しました（${e.status ?? "network"}）`);
    }
    throw e;
  }
  await run(
    "INSERT INTO ai_usage (purpose, model, input_tokens, output_tokens, created_at) VALUES (?, ?, ?, ?, ?)",
    purpose,
    cfg.model,
    res.usage.input_tokens,
    res.usage.output_tokens,
    Date.now(),
  );
  if (res.stop_reason === "refusal") throw new AiError("AIが生成を断りました。内容を変えて試してください");
  const text = res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) throw new AiError("AIの応答が空でした");
  return text;
}
