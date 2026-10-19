import { AIError, type AIProvider, type HealthStatus } from "./types";

/**
 * AIが使えないときのプロバイダー。生成そのものはせず、呼び出し側のルールベース処理・テンプレートに任せる。
 * （runAI が fallback 関数を実行する）
 */
export class FallbackProvider implements AIProvider {
  readonly id = "fallback" as const;
  async generateText(): Promise<string> {
    throw new AIError("AIは未接続です（テンプレートで作成します）");
  }
  async generateStructuredOutput<T>(): Promise<T> {
    throw new AIError("AIは未接続です（ルールベースで作成します）");
  }
  async healthCheck(): Promise<HealthStatus> {
    return { provider: "fallback", ok: true, message: "AIなし（ルール・テンプレートで動作）" };
  }
}
