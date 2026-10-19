import Anthropic from "@anthropic-ai/sdk";
import { parseStructured } from "./json";
import { AIError, type AIProvider, type HealthStatus, type StructuredRequest, type TextRequest } from "./types";

/** 任意: ANTHROPIC_API_KEY があるときだけ使う有料プロバイダー */
export class ClaudeProvider implements AIProvider {
  readonly id = "claude" as const;
  constructor(private readonly model: string) {}

  async generateText(req: TextRequest): Promise<string> {
    if (!process.env.ANTHROPIC_API_KEY) throw new AIError("ANTHROPIC_API_KEY が未設定です");
    try {
      const res = await new Anthropic().messages.create({
        model: this.model,
        max_tokens: req.maxTokens ?? 3000,
        system: req.system,
        messages: [{ role: "user", content: req.prompt }],
      });
      if (res.stop_reason === "refusal") throw new AIError("AIが生成を断りました。内容を変えて試してください");
      const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
      if (!text) throw new AIError("AIの応答が空でした");
      return text;
    } catch (e) {
      if (e instanceof AIError) throw e;
      if (e instanceof Anthropic.APIError) throw new AIError(`Claude API エラー（${e.status ?? "network"}）`);
      throw e;
    }
  }

  async generateStructuredOutput<T>(req: StructuredRequest<T>): Promise<T> {
    const text = await this.generateText({ ...req, system: `${req.system}\n\n出力はJSONのみ。説明文やコードブロックは付けないこと。` });
    return parseStructured(text, req.schema);
  }

  async healthCheck(): Promise<HealthStatus> {
    return process.env.ANTHROPIC_API_KEY
      ? { provider: "claude", ok: true, message: `APIキー設定済み（${this.model}）` }
      : { provider: "claude", ok: false, message: "ANTHROPIC_API_KEY が未設定です" };
  }
}
