import type { z } from "zod";

export type ProviderId = "ollama" | "claude" | "fallback";

export type TextRequest = {
  system: string;
  prompt: string;
  maxTokens?: number;
  /** ユーザーがキャンセルしたら中断する */
  signal?: AbortSignal;
};

export type StructuredRequest<T> = TextRequest & {
  schema: z.ZodType<T>;
};

export type HealthStatus = {
  provider: ProviderId;
  ok: boolean;
  /** 利用者向けの説明（未起動・モデル未取得など） */
  message: string;
  models?: string[];
};

/** すべてのAIプロバイダーが実装する共通インターフェース */
export interface AIProvider {
  readonly id: ProviderId;
  generateText(req: TextRequest): Promise<string>;
  generateStructuredOutput<T>(req: StructuredRequest<T>): Promise<T>;
  healthCheck(): Promise<HealthStatus>;
}

/** ユーザーによるキャンセル（フォールバックせずに止める） */
export class AICancelledError extends Error {
  constructor() {
    super("キャンセルしました");
  }
}

export class AIError extends Error {
  constructor(
    message: string,
    readonly retryHint = "設定画面で接続テストを行い、もう一度お試しください。",
  ) {
    super(message);
  }
}
