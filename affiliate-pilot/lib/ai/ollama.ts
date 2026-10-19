import { z } from "zod";
import { parseStructured } from "./json";
import { AICancelledError, AIError, type AIProvider, type HealthStatus, type StructuredRequest, type TextRequest } from "./types";

/** 通信先はローカル／LANのみ許可（外部サーバーに送らない） */
export function isAllowedOllamaUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const h = u.hostname.replace(/^\[|\]$/g, "");
    return (
      h === "localhost" ||
      h === "::1" ||
      /^127\./.test(h) ||
      /^10\./.test(h) ||
      /^192\.168\./.test(h) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
      h === "host.docker.internal"
    );
  } catch {
    return false;
  }
}

export class OllamaProvider implements AIProvider {
  readonly id = "ollama" as const;
  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly timeoutMs = 120_000,
  ) {
    if (!isAllowedOllamaUrl(baseUrl)) throw new AIError("Ollama の接続先はローカルまたは LAN 内のアドレスにしてください");
  }

  private async post(path: string, body: unknown, cancel?: AbortSignal): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: cancel ? AbortSignal.any([AbortSignal.timeout(this.timeoutMs), cancel]) : AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e) {
      if (cancel?.aborted) throw new AICancelledError();
      const timeout = e instanceof Error && e.name === "TimeoutError";
      throw new AIError(
        timeout ? "ローカルAIの応答が時間内に返りませんでした" : "ローカルAI（Ollama）に接続できませんでした",
        timeout ? "小さいモデルに切り替えるか、タイムアウトを延ばしてください。" : "Ollama を起動してから再試行してください（ollama serve）。",
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 404 && /model/i.test(text)) {
        throw new AIError(`モデル「${this.model}」が見つかりません`, `ターミナルで ollama pull ${this.model} を実行してください。`);
      }
      throw new AIError(`ローカルAIがエラーを返しました（${res.status}）`);
    }
    return res.json();
  }

  async generateText(req: TextRequest): Promise<string> {
    const data = (await this.post("/api/chat", {
      model: this.model,
      stream: false,
      options: { num_predict: req.maxTokens ?? 2000, temperature: 0.6 },
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.prompt },
      ],
    }, req.signal)) as { message?: { content?: string } };
    const text = data.message?.content?.trim();
    if (!text) throw new AIError("ローカルAIの応答が空でした");
    return text;
  }

  async generateStructuredOutput<T>(req: StructuredRequest<T>): Promise<T> {
    const data = (await this.post("/api/chat", {
      model: this.model,
      stream: false,
      format: z.toJSONSchema(req.schema),
      options: { num_predict: req.maxTokens ?? 3000, temperature: 0.3 },
      messages: [
        { role: "system", content: `${req.system}\n\n出力はJSONのみ。説明文やコードブロックは付けないこと。` },
        { role: "user", content: req.prompt },
      ],
    }, req.signal)) as { message?: { content?: string } };
    return parseStructured(data.message?.content ?? "", req.schema);
  }

  async healthCheck(): Promise<HealthStatus> {
    try {
      const res = await fetch(`${this.baseUrl.replace(/\/$/, "")}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return { provider: "ollama", ok: false, message: `Ollama が応答しません（${res.status}）` };
      const data = (await res.json()) as { models?: { name: string }[] };
      const models = (data.models ?? []).map((m) => m.name);
      const has = models.some((m) => m === this.model || m === `${this.model}:latest` || m.split(":")[0] === this.model);
      return has
        ? { provider: "ollama", ok: true, message: `接続OK（${this.model}）`, models }
        : { provider: "ollama", ok: false, message: `Ollama は起動していますが、モデル「${this.model}」が未取得です（ollama pull ${this.model}）`, models };
    } catch {
      return { provider: "ollama", ok: false, message: "Ollama が起動していません（未インストールまたは停止中）" };
    }
  }
}
