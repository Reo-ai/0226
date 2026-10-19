import { z } from "zod";
import { getProfile } from "./profile";
import { getSetting } from "./settings";

export const uiModeSchema = z.enum(["simple", "full"]);
export type UiMode = z.infer<typeof uiModeSchema>;

/**
 * 表示モード。設定があればそれを使い、なければ経験に合わせる
 * （初心者は「かんたん表示」、成果が出ている人は「くわしい表示」）
 */
export async function getUiMode(): Promise<UiMode> {
  const saved = await getSetting("ui_mode", uiModeSchema.nullable(), null);
  if (saved) return saved;
  const p = await getProfile();
  return p && (p.experienceLevel === "intermediate" || p.experienceLevel === "advanced") ? "full" : "simple";
}
