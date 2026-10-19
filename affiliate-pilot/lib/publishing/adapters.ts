/**
 * 投稿アダプター。初期版は「手動投稿」だけを実装する（コピー → 自分で投稿 → 公開URLを記録）。
 * 将来、各SNS・ブログの公式APIに対応するときは PublishingAdapter を実装して ADAPTERS に追加する。
 * スパム投稿・無断スクレイピング・規約回避につながる実装はしない。
 */
export type PublishRequest = { platform: string; title: string; body: string; cta: string };
export type PublishResult = { mode: "manual"; instructions: string[] } | { mode: "api"; publishedUrl: string };

export interface PublishingAdapter {
  readonly id: string;
  readonly platforms: readonly string[];
  /** 公式APIで投稿できるか（false なら手動） */
  readonly automatic: boolean;
  publish(req: PublishRequest): Promise<PublishResult>;
}

export const manualAdapter: PublishingAdapter = {
  id: "manual",
  platforms: ["blog", "instagram", "x", "tiktok", "youtube"],
  automatic: false,
  async publish(req) {
    return {
      mode: "manual",
      instructions: [
        "コンテンツ工房で「本文をコピー」を押す",
        `${req.platform === "blog" ? "ブログの管理画面" : "アプリ"}に貼り付け、画像・動画を添えて自分で投稿する`,
        "投稿したページのURLをコンテンツ工房の「公開URLを記録」に入力する",
      ],
    };
  },
};

export const ADAPTERS: PublishingAdapter[] = [manualAdapter];

export function adapterFor(platform: string): PublishingAdapter {
  return ADAPTERS.find((a) => a.automatic && a.platforms.includes(platform)) ?? manualAdapter;
}
